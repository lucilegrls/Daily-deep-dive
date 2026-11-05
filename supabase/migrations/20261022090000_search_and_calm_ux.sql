-- Search is word-aware and relevance-ranked. Subject filters use the stable
-- onboarding lanes, while exact editorial categories remain available as a
-- secondary filter.

INSERT INTO public.interest_lane_categories (lane_slug, category) VALUES
  ('technology-ai', 'Science & technology'),
  ('technology-ai', 'Science & Technology'),
  ('economics-investing', 'Economics & personal finance'),
  ('economics-investing', 'Finance & economics')
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.feed_topics(
  _query text DEFAULT ''::text,
  _category text DEFAULT NULL::text,
  _interests text[] DEFAULT '{}'::text[],
  _read_ids integer[] DEFAULT '{}'::integer[],
  _seed integer DEFAULT 0,
  _limit integer DEFAULT 12,
  _offset integer DEFAULT 0,
  _mix text DEFAULT 'balanced'::text
)
RETURNS TABLE(id integer, slug text, title text, category text, context text, takeaways text[], tags text[], last_verified date, total_count bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  WITH cfg AS (
    SELECT CASE lower(coalesce(_mix, 'balanced'))
             WHEN 'focused' THEN 9
             WHEN 'exploratory' THEN 1
             ELSE 3
           END AS pref_per_other
  ), query_terms AS (
    SELECT DISTINCT token
    FROM regexp_split_to_table(lower(trim(coalesce(_query, ''))), '[^[:alnum:]]+') AS token
    WHERE token <> ''
    LIMIT 12
  ), base AS (
    SELECT t.id, t.slug, t.title, t.category, t.context, t.takeaways, t.tags, t.last_verified,
           (t.id = ANY(coalesce(_read_ids, '{}'::integer[])))::int AS already_read,
           CASE WHEN t.category IN (SELECT unnest(public.expand_interests(_interests))) THEN 0 ELSE 1 END AS pref_rank,
           coalesce((
             SELECT sum(
               CASE WHEN lower(t.title) ~ ('\m' || q.token || '\M') THEN 100 ELSE 0 END +
               CASE WHEN lower(array_to_string(t.tags, ' ')) ~ ('\m' || q.token || '\M') THEN 60 ELSE 0 END +
               CASE WHEN lower(t.category) ~ ('\m' || q.token || '\M') THEN 30 ELSE 0 END +
               CASE WHEN lower(t.context) ~ ('\m' || q.token || '\M') THEN 10 ELSE 0 END
             )
             FROM query_terms q
           ), 0)::integer AS search_rank
    FROM public.content_topics t
    WHERE t.status = 'published'
      AND (
        _category IS NULL
        OR t.category = _category
        OR (_category = 'Finance & economics' AND t.category = 'Economics & personal finance')
        OR (_category = 'Science & technology' AND t.category = 'Science & Technology')
        OR EXISTS (
          SELECT 1
          FROM public.interest_lane_categories lc
          JOIN public.interest_lanes l ON l.slug = lc.lane_slug AND l.active
          WHERE lc.lane_slug = _category AND lc.category = t.category
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM query_terms q
        WHERE NOT (
          lower(t.title) ~ ('\m' || q.token || '\M')
          OR lower(array_to_string(t.tags, ' ')) ~ ('\m' || q.token || '\M')
          OR lower(t.category) ~ ('\m' || q.token || '\M')
          OR lower(t.context) ~ ('\m' || q.token || '\M')
        )
      )
  ), ordered AS (
    SELECT b.*,
           row_number() OVER (
             PARTITION BY b.already_read, b.pref_rank
             ORDER BY md5(b.id::text || ':' || coalesce(_seed, 0)::text)
           ) AS slot
    FROM base b
  )
  SELECT o.id, o.slug, o.title, o.category, o.context, o.takeaways, o.tags, o.last_verified,
         (SELECT count(*) FROM base) AS total_count
  FROM ordered o, cfg c
  ORDER BY
    CASE WHEN coalesce(trim(_query), '') <> '' THEN o.search_rank END DESC,
    o.already_read,
    CASE WHEN o.pref_rank = 0
         THEN (o.slot - 1) * (c.pref_per_other + 1) / c.pref_per_other
         ELSE (o.slot - 1) * (c.pref_per_other + 1) + c.pref_per_other
    END,
    o.pref_rank,
    o.id
  LIMIT least(coalesce(_limit, 12), 60) OFFSET greatest(coalesce(_offset, 0), 0);
$function$;

CREATE OR REPLACE FUNCTION public.search_topics(
  _query text DEFAULT ''::text,
  _category text DEFAULT NULL::text,
  _limit integer DEFAULT 12,
  _offset integer DEFAULT 0
)
RETURNS TABLE(id integer, slug text, title text, category text, context text, takeaways text[], tags text[], last_verified date, total_count bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  WITH query_terms AS (
    SELECT DISTINCT token
    FROM regexp_split_to_table(lower(trim(coalesce(_query, ''))), '[^[:alnum:]]+') AS token
    WHERE token <> ''
    LIMIT 12
  ), base AS (
    SELECT t.id, t.slug, t.title, t.category, t.context, t.takeaways, t.tags, t.last_verified,
           coalesce((
             SELECT sum(
               CASE WHEN lower(t.title) ~ ('\m' || q.token || '\M') THEN 100 ELSE 0 END +
               CASE WHEN lower(array_to_string(t.tags, ' ')) ~ ('\m' || q.token || '\M') THEN 60 ELSE 0 END +
               CASE WHEN lower(t.category) ~ ('\m' || q.token || '\M') THEN 30 ELSE 0 END +
               CASE WHEN lower(t.context) ~ ('\m' || q.token || '\M') THEN 10 ELSE 0 END
             ) FROM query_terms q
           ), 0)::integer AS search_rank
    FROM public.content_topics t
    WHERE t.status = 'published'
      AND (
        _category IS NULL
        OR t.category = _category
        OR (_category = 'Finance & economics' AND t.category = 'Economics & personal finance')
        OR (_category = 'Science & technology' AND t.category = 'Science & Technology')
      )
      AND NOT EXISTS (
        SELECT 1 FROM query_terms q
        WHERE NOT (
          lower(t.title) ~ ('\m' || q.token || '\M')
          OR lower(array_to_string(t.tags, ' ')) ~ ('\m' || q.token || '\M')
          OR lower(t.category) ~ ('\m' || q.token || '\M')
          OR lower(t.context) ~ ('\m' || q.token || '\M')
        )
      )
  )
  SELECT b.id, b.slug, b.title, b.category, b.context, b.takeaways, b.tags, b.last_verified,
         (SELECT count(*) FROM base) AS total_count
  FROM base b
  ORDER BY b.search_rank DESC, b.id
  LIMIT least(coalesce(_limit, 12), 60) OFFSET greatest(coalesce(_offset, 0), 0);
$function$;

-- Minimal, first-party beta measurement. It stores no query text, email, IP,
-- free-form metadata or cross-site identifier. Public clients can only call the
-- bounded RPC; only editors can read the aggregate-ready rows.
CREATE TABLE public.ux_events (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  journey_id uuid NOT NULL,
  surface text NOT NULL CHECK (surface IN ('onboarding', 'reading_community')),
  variant text NULL CHECK (variant IN ('signup', 'edit', 'week', 'all')),
  event_name text NOT NULL CHECK (event_name IN (
    'step_viewed', 'step_completed', 'step_back', 'journey_skipped',
    'journey_completed', 'community_viewed', 'period_changed'
  )),
  step smallint NULL CHECK (step BETWEEN 0 AND 3),
  elapsed_ms integer NULL CHECK (elapsed_ms BETWEEN 0 AND 3600000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ux_events_journey_recent_idx
  ON public.ux_events (journey_id, created_at DESC);
CREATE INDEX ux_events_funnel_idx
  ON public.ux_events (surface, variant, event_name, step, created_at DESC);

ALTER TABLE public.ux_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ux_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.ux_events TO authenticated;
CREATE POLICY ux_events_editor_read ON public.ux_events
  FOR SELECT TO authenticated USING (public.is_editor());

CREATE OR REPLACE FUNCTION public.record_ux_event(
  _journey_id uuid,
  _surface text,
  _event_name text,
  _variant text DEFAULT NULL,
  _step smallint DEFAULT NULL,
  _elapsed_ms integer DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF _journey_id IS NULL
     OR _surface NOT IN ('onboarding', 'reading_community')
     OR _event_name NOT IN (
       'step_viewed', 'step_completed', 'step_back', 'journey_skipped',
       'journey_completed', 'community_viewed', 'period_changed'
     )
     OR (_variant IS NOT NULL AND _variant NOT IN ('signup', 'edit', 'week', 'all'))
     OR (_step IS NOT NULL AND (_step < 0 OR _step > 3)) THEN
    RETURN false;
  END IF;

  -- Browser-local journey ids and a small rolling cap prevent accidental
  -- duplicates and unbounded anonymous writes without collecting an IP.
  IF (SELECT count(*) FROM public.ux_events
      WHERE journey_id = _journey_id AND created_at > now() - interval '1 hour') >= 30 THEN
    RETURN false;
  END IF;

  INSERT INTO public.ux_events(user_id, journey_id, surface, event_name, variant, step, elapsed_ms)
  VALUES (
    auth.uid(), _journey_id, _surface, _event_name, _variant, _step,
    CASE WHEN _elapsed_ms IS NULL THEN NULL ELSE greatest(0, least(_elapsed_ms, 3600000)) END
  );
  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.record_ux_event(uuid, text, text, text, smallint, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_ux_event(uuid, text, text, text, smallint, integer) TO anon, authenticated;
