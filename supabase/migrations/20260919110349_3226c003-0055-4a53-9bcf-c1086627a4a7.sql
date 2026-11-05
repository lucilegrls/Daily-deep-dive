-- 1. Editor-only storage for private editorial fields ------------------------

CREATE TABLE public.content_topic_private (
  topic_id integer PRIMARY KEY REFERENCES public.content_topics(id) ON DELETE CASCADE,
  editorial_notes text,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_topic_private TO authenticated;
GRANT ALL ON public.content_topic_private TO service_role;

ALTER TABLE public.content_topic_private ENABLE ROW LEVEL SECURITY;

CREATE POLICY topic_private_editor_read ON public.content_topic_private
  FOR SELECT TO authenticated USING (public.is_editor());
CREATE POLICY topic_private_editor_write ON public.content_topic_private
  FOR ALL TO authenticated USING (public.is_editor()) WITH CHECK (public.is_editor());

CREATE TRIGGER content_topic_private_touch BEFORE UPDATE ON public.content_topic_private
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.content_topic_private (topic_id, editorial_notes, provenance)
SELECT id, editorial_notes, provenance FROM public.content_topics
ON CONFLICT (topic_id) DO NOTHING;

CREATE TABLE public.content_resource_private (
  resource_id uuid PRIMARY KEY REFERENCES public.content_resources(id) ON DELETE CASCADE,
  credibility_notes text,
  selection_reason text,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_resource_private TO authenticated;
GRANT ALL ON public.content_resource_private TO service_role;

ALTER TABLE public.content_resource_private ENABLE ROW LEVEL SECURITY;

CREATE POLICY resource_private_editor_read ON public.content_resource_private
  FOR SELECT TO authenticated USING (public.is_editor());
CREATE POLICY resource_private_editor_write ON public.content_resource_private
  FOR ALL TO authenticated USING (public.is_editor()) WITH CHECK (public.is_editor());

CREATE TRIGGER content_resource_private_touch BEFORE UPDATE ON public.content_resource_private
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.content_resource_private (resource_id, credibility_notes, selection_reason, rejection_reason)
SELECT id, credibility_notes, selection_reason, rejection_reason FROM public.content_resources
ON CONFLICT (resource_id) DO NOTHING;

ALTER TABLE public.content_topics DROP COLUMN editorial_notes;
ALTER TABLE public.content_topics DROP COLUMN provenance;
ALTER TABLE public.content_resources DROP COLUMN credibility_notes;
ALTER TABLE public.content_resources DROP COLUMN selection_reason;
ALTER TABLE public.content_resources DROP COLUMN rejection_reason;

-- 2. Anonymous readers get only the public columns ---------------------------

REVOKE SELECT ON public.content_topics FROM anon;
GRANT SELECT (id, slug, title, category, context, takeaways, tags, related_ids,
              difficulty, status, last_verified, published_at, created_at, updated_at)
  ON public.content_topics TO anon;

REVOKE SELECT ON public.content_resources FROM anon;
GRANT SELECT (id, topic_id, kind, title, url, author, source, publication, creator,
              duration, difficulty, format, description, concepts, verification,
              review_status, last_checked, position, created_at, updated_at)
  ON public.content_resources TO anon;

-- 3. Consistent host normalisation for the no-Wikipedia rule -----------------

CREATE OR REPLACE FUNCTION public.is_safe_source_url(_url text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE
  authority text;
  host text;
BEGIN
  IF _url IS NULL THEN RETURN false; END IF;
  IF lower(_url) !~ '^https?://' THEN RETURN false; END IF;

  -- authority = everything between the scheme and the first /, ? or #
  authority := split_part(regexp_replace(_url, '^(?i)https?://', ''), '/', 1);
  authority := split_part(split_part(authority, '?', 1), '#', 1);
  -- drop any userinfo, then any port
  authority := regexp_replace(authority, '^.*@', '');
  host := lower(split_part(authority, ':', 1));
  -- strip IPv6 brackets, trailing root dots and surrounding whitespace
  host := btrim(host);
  host := regexp_replace(host, '^\[|\]$', '', 'g');
  host := regexp_replace(host, '\.+$', '');

  IF host = '' OR host ~ '\s' THEN RETURN false; END IF;

  IF host IN ('wikipedia.org', 'wikimedia.org', 'wikiwand.com', 'wikibooks.org',
              'wikisource.org', 'wikiquote.org', 'wikidata.org', 'wiktionary.org',
              'dbpedia.org')
     OR host LIKE '%.wikipedia.org'
     OR host LIKE '%.wikimedia.org'
     OR host LIKE '%.wikiwand.com'
     OR host LIKE '%.wikibooks.org'
     OR host LIKE '%.wikisource.org'
     OR host LIKE '%.wikiquote.org'
     OR host LIKE '%.wikidata.org'
     OR host LIKE '%.wiktionary.org'
     OR host LIKE '%.dbpedia.org'
  THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$function$;

-- 4. Stable, personalised server-side feed order -----------------------------

CREATE OR REPLACE FUNCTION public.feed_topics(
  _query text DEFAULT ''::text,
  _category text DEFAULT NULL::text,
  _interests text[] DEFAULT '{}'::text[],
  _read_ids integer[] DEFAULT '{}'::integer[],
  _seed integer DEFAULT 0,
  _limit integer DEFAULT 12,
  _offset integer DEFAULT 0
)
RETURNS TABLE(id integer, slug text, title text, category text, context text,
              takeaways text[], tags text[], last_verified date, total_count bigint)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  WITH base AS (
    SELECT t.id, t.slug, t.title, t.category, t.context, t.takeaways, t.tags, t.last_verified,
           (t.id = ANY(_read_ids)) AS already_read,
           (t.category = ANY(_interests)) AS preferred,
           md5(t.id::text || ':' || _seed::text) AS jitter
    FROM public.content_topics t
    WHERE t.status = 'published'
      AND (_category IS NULL OR t.category = _category)
      AND (coalesce(trim(_query), '') = '' OR t.search_text LIKE '%' || lower(trim(_query)) || '%')
  ),
  ranked AS (
    SELECT b.*,
           row_number() OVER (PARTITION BY b.already_read, b.preferred ORDER BY b.jitter, b.id) AS rn
    FROM base b
  ),
  ordered AS (
    SELECT r.*,
           CASE
             WHEN NOT coalesce(array_length(_interests, 1), 0) > 0 THEN r.rn::numeric
             WHEN r.preferred THEN r.rn + floor((r.rn - 1) / 3.0)
             ELSE 4 * r.rn
           END AS slot
    FROM ranked r
  )
  SELECT o.id, o.slug, o.title, o.category, o.context, o.takeaways, o.tags, o.last_verified,
         (SELECT count(*) FROM base) AS total_count
  FROM ordered o
  ORDER BY o.already_read, o.slot, o.jitter, o.id
  LIMIT least(coalesce(_limit, 12), 60) OFFSET greatest(coalesce(_offset, 0), 0);
$function$;

REVOKE ALL ON FUNCTION public.feed_topics(text, text, text[], integer[], integer, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.feed_topics(text, text, text[], integer[], integer, integer, integer) TO anon, authenticated, service_role;