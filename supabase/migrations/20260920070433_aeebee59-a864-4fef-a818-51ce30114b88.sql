ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS feed_mix text NOT NULL DEFAULT 'balanced';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_feed_mix_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_feed_mix_check
  CHECK (feed_mix IN ('focused', 'balanced', 'exploratory'));

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
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH cfg AS (
    SELECT CASE lower(coalesce(_mix, 'balanced'))
             WHEN 'focused' THEN 9
             WHEN 'exploratory' THEN 1
             ELSE 3
           END AS pref_per_other
  ), base AS (
    SELECT t.id, t.slug, t.title, t.category, t.context, t.takeaways, t.tags, t.last_verified,
           (t.id = ANY(coalesce(_read_ids, '{}'::integer[])))::int AS already_read,
           CASE WHEN t.category = ANY(coalesce(_interests, '{}'::text[])) THEN 0 ELSE 1 END AS pref_rank
    FROM public.content_topics t
    WHERE t.status = 'published'
      AND (_category IS NULL OR t.category = _category)
      AND (coalesce(trim(_query), '') = '' OR t.search_text LIKE '%' || lower(trim(_query)) || '%')
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
  ORDER BY o.already_read,
           CASE WHEN o.pref_rank = 0
                THEN (o.slot - 1) * (c.pref_per_other + 1) / c.pref_per_other
                ELSE (o.slot - 1) * (c.pref_per_other + 1) + c.pref_per_other
           END,
           o.pref_rank,
           o.id
  LIMIT least(coalesce(_limit, 12), 60) OFFSET greatest(coalesce(_offset, 0), 0);
$function$;

REVOKE ALL ON FUNCTION public.feed_topics(text, text, text[], integer[], integer, integer, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.feed_topics(text, text, text[], integer[], integer, integer, integer, text) TO anon, authenticated, service_role;

-- Idempotent, server-authorised completion of the onboarding journey.
-- Only ever touches the caller's own profile and interests; it cannot grant roles.
CREATE OR REPLACE FUNCTION public.apply_onboarding(
  _interests text[],
  _feed_mix text,
  _theme text,
  _force boolean DEFAULT false
)
RETURNS TABLE(applied boolean, onboarded boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _already boolean;
  _mix text := CASE WHEN lower(coalesce(_feed_mix, '')) IN ('focused','balanced','exploratory')
                    THEN lower(_feed_mix) ELSE 'balanced' END;
  _clean text[];
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  INSERT INTO public.profiles (id) VALUES (_uid) ON CONFLICT (id) DO NOTHING;
  SELECT p.onboarded INTO _already FROM public.profiles p WHERE p.id = _uid;

  IF _already AND NOT coalesce(_force, false) THEN
    RETURN QUERY SELECT false, true;
    RETURN;
  END IF;

  SELECT coalesce(array_agg(DISTINCT c.category), '{}'::text[])
    INTO _clean
  FROM public.content_topics c
  WHERE c.status = 'published'
    AND c.category = ANY(coalesce(_interests, '{}'::text[]));

  DELETE FROM public.user_interests WHERE user_id = _uid;
  IF array_length(_clean, 1) > 0 THEN
    INSERT INTO public.user_interests (user_id, subject)
    SELECT _uid, unnest(_clean)
    ON CONFLICT DO NOTHING;
  END IF;

  UPDATE public.profiles
     SET feed_mix = _mix,
         theme = CASE WHEN coalesce(_theme, '') = '' THEN theme ELSE _theme END,
         onboarded = true,
         updated_at = now()
   WHERE id = _uid;

  RETURN QUERY SELECT true, true;
END;
$function$;

REVOKE ALL ON FUNCTION public.apply_onboarding(text[], text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_onboarding(text[], text, text, boolean) TO authenticated;