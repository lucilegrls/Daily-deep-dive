-- Streak tests (local time zone). ONE transaction, always aborted: nothing is kept.
-- Output: "STREAK_RESULTS passed=N failed=M :: ..."
BEGIN;
CREATE TEMP TABLE _s (name text, ok boolean);
SELECT set_config('s.u', (SELECT user_id::text FROM user_roles WHERE role='owner' LIMIT 1), true);
SELECT set_config('request.jwt.claims', json_build_object('sub', current_setting('s.u'))::text, true);
DELETE FROM topic_reads WHERE user_id = current_setting('s.u')::uuid;
ALTER TABLE topic_reads DISABLE TRIGGER USER; -- allow back-dated fixtures inside this aborted transaction

-- Reads at 00:30 Bangkok on three consecutive local days (17:30 UTC the previous UTC day)
INSERT INTO topic_reads(user_id, topic_id, seconds, read_at, read_day)
SELECT current_setting('s.u')::uuid, t.id, 30,
       ((now() AT TIME ZONE 'Asia/Bangkok')::date - g + time '00:30') AT TIME ZONE 'Asia/Bangkok',
       (((now() AT TIME ZONE 'Asia/Bangkok')::date - g + time '00:30') AT TIME ZONE 'Asia/Bangkok' AT TIME ZONE 'utc')::date
FROM generate_series(0,2) g
JOIN LATERAL (SELECT id FROM content_topics WHERE status='published' ORDER BY id OFFSET g LIMIT 1) t ON true;

INSERT INTO _s SELECT '1 three local days = streak 3 in Bangkok', current_streak = 3 FROM my_streak('Asia/Bangkok');
INSERT INTO _s SELECT '2 best streak 3', best_streak = 3 FROM my_streak('Asia/Bangkok');
INSERT INTO _s SELECT '3 unknown time zone falls back safely', current_streak >= 0 FROM my_streak('Not/AZone');

DELETE FROM topic_reads WHERE user_id = current_setting('s.u')::uuid
  AND (read_at AT TIME ZONE 'Asia/Bangkok')::date = (now() AT TIME ZONE 'Asia/Bangkok')::date - 1;
INSERT INTO _s SELECT '4 gap breaks current streak', current_streak = 1 FROM my_streak('Asia/Bangkok');

DO $$ DECLARE p int; f int; d text; BEGIN
  SELECT count(*) FILTER (WHERE ok), count(*) FILTER (WHERE NOT ok OR ok IS NULL),
         string_agg(name || '=' || coalesce(ok::text,'null'), '; ') INTO p, f, d FROM _s;
  RAISE EXCEPTION 'STREAK_RESULTS passed=% failed=% :: %', p, f, d;
END $$;
