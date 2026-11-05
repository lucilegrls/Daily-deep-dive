-- Source-health security/integrity tests (7 checks).
-- Runs in ONE transaction and always aborts: nothing is ever kept, no real
-- user content is read or written, no secrets are printed. Repeatable.
-- Run: bash tests/rls/run.sh   (needs a privileged session, e.g. psql as postgres)
-- Output: "HEALTH_RESULTS passed=N failed=M :: ..."
BEGIN;
CREATE TEMP TABLE _h (name text, ok boolean);
GRANT ALL ON _h TO anon, authenticated;
SELECT set_config('h.owner', (SELECT user_id::text FROM user_roles WHERE role='owner' LIMIT 1), true);
-- Test subject: any approved source. Its health fields are restored by the abort.
SELECT set_config('h.res', (SELECT id::text FROM content_resources WHERE review_status='approved' ORDER BY id LIMIT 1), true);
SELECT set_config('h.rev', (SELECT review_status FROM content_resources WHERE id = current_setting('h.res')::uuid), true);
UPDATE content_resources SET consecutive_failures = 0, needs_review = false, needs_review_reason = null WHERE id = current_setting('h.res')::uuid;
DELETE FROM source_link_checks WHERE resource_id = current_setting('h.res')::uuid;

-- 1. Visitor cannot record a check
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims','{"role":"anon"}', true);
DO $$ BEGIN INSERT INTO source_link_checks(resource_id, outcome) VALUES (current_setting('h.res')::uuid, 'ok');
  INSERT INTO _h VALUES ('1 visitor cannot record checks', false);
EXCEPTION WHEN insufficient_privilege THEN INSERT INTO _h VALUES ('1 visitor cannot record checks', true); END $$;
RESET ROLE;

-- 2/3. Reader (no role) cannot record checks nor edit health fields
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-a000-00000000000a","role":"authenticated"}', true);
DO $$ BEGIN INSERT INTO source_link_checks(resource_id, outcome) VALUES (current_setting('h.res')::uuid, 'ok');
  INSERT INTO _h VALUES ('2 reader cannot record checks', false);
EXCEPTION WHEN insufficient_privilege THEN INSERT INTO _h VALUES ('2 reader cannot record checks', true); END $$;
DO $$ DECLARE n int; BEGIN
  WITH u AS (UPDATE content_resources SET link_status='ok', needs_review=false WHERE id = current_setting('h.res')::uuid RETURNING 1) SELECT count(*) INTO n FROM u;
  INSERT INTO _h VALUES ('3 reader cannot edit health fields', n = 0);
EXCEPTION WHEN insufficient_privilege THEN INSERT INTO _h VALUES ('3 reader cannot edit health fields', true); END $$;
RESET ROLE;

-- 4/5. Editor records two failures: flagged for review, never unapproved or deleted
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', current_setting('h.owner')::uuid, 'role','authenticated')::text, true);
INSERT INTO source_link_checks(resource_id, outcome, checked_at) VALUES (current_setting('h.res')::uuid, 'broken', now());
UPDATE source_link_checks SET outcome='broken', checked_at=now() WHERE resource_id = current_setting('h.res')::uuid;
INSERT INTO _h SELECT '4 repeated failure flags review', needs_review AND consecutive_failures = 2 FROM content_resources WHERE id = current_setting('h.res')::uuid;
INSERT INTO _h SELECT '5 failure never unapproves or deletes', count(*) = 1 AND bool_and(review_status = current_setting('h.rev')) FROM content_resources WHERE id = current_setting('h.res')::uuid;

-- 6/7. Success resets failures but never approves (use a non-approved row when one exists)
UPDATE source_link_checks SET outcome='ok', checked_at=now() WHERE resource_id = current_setting('h.res')::uuid;
INSERT INTO _h SELECT '6 success resets failures', consecutive_failures = 0 AND link_status = 'ok' FROM content_resources WHERE id = current_setting('h.res')::uuid;
RESET ROLE;
DO $$ DECLARE cand uuid; BEGIN
  SELECT id INTO cand FROM content_resources WHERE review_status <> 'approved' ORDER BY id LIMIT 1;
  IF cand IS NULL THEN INSERT INTO _h VALUES ('7 success never approves (no candidate row; skipped as pass)', true); RETURN; END IF;
  DELETE FROM source_link_checks WHERE resource_id = cand;
  INSERT INTO source_link_checks(resource_id, outcome) VALUES (cand, 'ok');
  INSERT INTO _h SELECT '7 success never approves', review_status <> 'approved' FROM content_resources WHERE id = cand;
END $$;

DO $$ BEGIN RAISE EXCEPTION 'HEALTH_RESULTS passed=% failed=% :: %',
  (SELECT count(*) FILTER (WHERE ok) FROM _h), (SELECT count(*) FILTER (WHERE NOT ok) FROM _h),
  (SELECT string_agg(CASE WHEN ok THEN 'PASS ' ELSE 'FAIL ' END || name, ' | ' ORDER BY name) FROM _h); END $$;
ROLLBACK;
