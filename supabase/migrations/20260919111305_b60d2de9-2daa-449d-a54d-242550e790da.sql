CREATE OR REPLACE FUNCTION public.feed_topics(
  _query text DEFAULT ''::text,
  _category text DEFAULT NULL::text,
  _interests text[] DEFAULT '{}'::text[],
  _read_ids integer[] DEFAULT '{}'::integer[],
  _seed integer DEFAULT 0,
  _limit integer DEFAULT 12,
  _offset integer DEFAULT 0
)
RETURNS TABLE(id integer, slug text, title text, category text, context text, takeaways text[], tags text[], last_verified date, total_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH base AS (
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
  FROM ordered o
  ORDER BY o.already_read,
           -- three preferred topics for each one from elsewhere
           CASE WHEN o.pref_rank = 0 THEN (o.slot - 1) * 4 / 3 ELSE (o.slot - 1) * 4 + 3 END,
           o.pref_rank,
           o.id
  LIMIT least(coalesce(_limit, 12), 60) OFFSET greatest(coalesce(_offset, 0), 0);
$$;

REVOKE ALL ON FUNCTION public.feed_topics(text, text, text[], integer[], integer, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.feed_topics(text, text, text[], integer[], integer, integer, integer) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.search_topics(_query text DEFAULT ''::text, _category text DEFAULT NULL::text, _limit integer DEFAULT 12, _offset integer DEFAULT 0)
RETURNS TABLE(id integer, slug text, title text, category text, context text, takeaways text[], tags text[], last_verified date, total_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH base AS (
    SELECT t.id, t.slug, t.title, t.category, t.context, t.takeaways, t.tags, t.last_verified
    FROM public.content_topics t
    WHERE t.status = 'published'
      AND (_category IS NULL OR t.category = _category)
      AND (coalesce(trim(_query), '') = '' OR t.search_text LIKE '%' || lower(trim(_query)) || '%')
  )
  SELECT b.id, b.slug, b.title, b.category, b.context, b.takeaways, b.tags, b.last_verified,
         (SELECT count(*) FROM base) AS total_count
  FROM base b
  ORDER BY b.id
  LIMIT least(coalesce(_limit, 12), 60) OFFSET greatest(coalesce(_offset, 0), 0);
$$;

REVOKE ALL ON FUNCTION public.search_topics(text, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_topics(text, text, integer, integer) TO anon, authenticated, service_role;