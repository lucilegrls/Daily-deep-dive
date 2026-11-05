-- Non-destructive feed/search scale benchmark. Builds a TEMP copy of the
-- published library multiplied to ~5,000 topics (nothing touches real tables),
-- runs the same ordering/search logic as feed_topics, prints timings, rolls back.
-- Run: psql -X -f tests/perf/feed_benchmark.sql
BEGIN;
CREATE TEMP TABLE bench_topics AS
SELECT (t.id + g * 100000) AS id, t.slug || '-' || g AS slug, t.title, t.category, t.context,
       t.takeaways, t.tags, t.last_verified, t.search_text, t.status
FROM content_topics t, generate_series(0, 15) g WHERE t.status = 'published';
CREATE INDEX ON bench_topics USING gin (search_text extensions.gin_trgm_ops);
CREATE INDEX ON bench_topics (status, id);
ANALYZE bench_topics;
SELECT count(*) AS bench_topic_count FROM bench_topics;

\timing on
-- Feed page deep in the list (offset 3000), balanced mix, two interests.
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, SUMMARY ON)
WITH base AS (
  SELECT b.id, b.title, (b.id = ANY('{1,2,3}'::int[]))::int AS already_read,
         CASE WHEN b.category IN ('Science','History') THEN 0 ELSE 1 END AS pref_rank
  FROM bench_topics b WHERE b.status = 'published'
), ordered AS (
  SELECT base.*, row_number() OVER (PARTITION BY already_read, pref_rank ORDER BY md5(id::text || ':42')) slot FROM base
)
SELECT id, title, (SELECT count(*) FROM base) FROM ordered
ORDER BY already_read, CASE WHEN pref_rank = 0 THEN (slot - 1) * 4 / 3 ELSE (slot - 1) * 4 + 3 END, pref_rank, id
LIMIT 12 OFFSET 3000;

-- Search (trigram index).
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, SUMMARY ON)
SELECT id, title FROM bench_topics WHERE status = 'published' AND search_text LIKE '%memory%' LIMIT 12;
\timing off
ROLLBACK;
