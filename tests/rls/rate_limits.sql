-- Write rate-limit tests. ONE transaction, always aborted: nothing is kept.
-- Uses the owner account id only inside the aborted transaction; no content is printed.
-- Output: "RATE_RESULTS passed=N failed=M :: ..."
BEGIN;
CREATE TEMP TABLE _r (name text, ok boolean);
SELECT set_config('r.u', (SELECT user_id::text FROM user_roles WHERE role='owner' LIMIT 1), true);

-- 1/2. Reads: normal reading allowed, 301st distinct topic in a UTC day refused
DO $$ DECLARE u uuid := current_setting('r.u')::uuid; t int; refused boolean := false; first_ok boolean := false; BEGIN
  FOR t IN SELECT id FROM content_topics WHERE status='published' AND id NOT IN
      (SELECT topic_id FROM topic_reads WHERE user_id=u AND read_day=(now() AT TIME ZONE 'utc')::date) ORDER BY id LOOP
    BEGIN
      INSERT INTO topic_reads(user_id, topic_id, seconds) VALUES (u, t, 30);
      first_ok := true;
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM = 'rate_limited' THEN refused := true; EXIT; END IF; RAISE;
    END;
  END LOOP;
  INSERT INTO _r VALUES ('1 normal read accepted', first_ok);
  INSERT INTO _r SELECT '2 reads capped at 300/day', refused AND count(*) = 300 FROM topic_reads WHERE user_id=u AND read_day=(now() AT TIME ZONE 'utc')::date;
END $$;

-- 3/4/5. Saves: normal save allowed, 301st in 24h refused, forged old created_at ignored
DO $$ DECLARE u uuid := current_setting('r.u')::uuid; t int; refused boolean := false; first_ok boolean := false; BEGIN
  FOR t IN SELECT id FROM content_topics WHERE status='published' AND id NOT IN
      (SELECT topic_id FROM saved_topics WHERE user_id=u) ORDER BY id LOOP
    BEGIN
      INSERT INTO saved_topics(user_id, topic_id, created_at) VALUES (u, t, now() - interval '30 days');
      first_ok := true;
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM = 'rate_limited' THEN refused := true; EXIT; END IF; RAISE;
    END;
  END LOOP;
  INSERT INTO _r VALUES ('3 normal save accepted', first_ok);
  INSERT INTO _r VALUES ('4 saves capped at 300/24h (forged dates ignored)', refused);
  INSERT INTO _r SELECT '5 save timestamp is server-stamped', bool_and(created_at > now() - interval '1 minute')
    FROM saved_topics WHERE user_id=u AND created_at > now() - interval '1 minute';
END $$;

-- 6/7. Embed-failure reports: allowed, 21st per reporter per day refused
DO $$ DECLARE u uuid := current_setting('r.u')::uuid; r uuid; refused boolean := false; first_ok boolean := false; BEGIN
  FOR r IN SELECT id FROM content_resources WHERE review_status='approved' AND id NOT IN
      (SELECT resource_id FROM resource_embed_failures WHERE reporter=u AND report_day=(now() AT TIME ZONE 'utc')::date) ORDER BY id LIMIT 40 LOOP
    BEGIN
      INSERT INTO resource_embed_failures(resource_id, reporter, reason, report_day) VALUES (r, u, 'test', date '2000-01-01');
      first_ok := true;
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM = 'rate_limited' THEN refused := true; EXIT; END IF; RAISE;
    END;
  END LOOP;
  INSERT INTO _r VALUES ('6 normal report accepted', first_ok);
  INSERT INTO _r SELECT '7 reports capped at 20/day (forged day ignored)', refused AND count(*) = 20
    FROM resource_embed_failures WHERE reporter=u AND report_day=(now() AT TIME ZONE 'utc')::date;
END $$;

-- 8. Suggestions: 11th in 24h refused (existing guard)
DO $$ DECLARE u uuid := current_setting('r.u')::uuid; i int; refused boolean := false; BEGIN
  FOR i IN 1..12 LOOP
    BEGIN
      INSERT INTO topic_suggestions(user_id, title) VALUES (u, 'Rate limit test topic number ' || i);
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM = 'suggestion_rate_limit' THEN refused := true; EXIT; END IF; RAISE;
    END;
  END LOOP;
  INSERT INTO _r VALUES ('8 suggestions capped at 10/24h', refused);
END $$;

DO $$ BEGIN RAISE EXCEPTION 'RATE_RESULTS passed=% failed=% :: %',
  (SELECT count(*) FILTER (WHERE ok) FROM _r), (SELECT count(*) FILTER (WHERE NOT ok) FROM _r),
  (SELECT string_agg(CASE WHEN ok THEN 'PASS ' ELSE 'FAIL ' END || name, ' | ' ORDER BY name) FROM _r); END $$;
ROLLBACK;
