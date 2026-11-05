-- Row-level security role tests. Runs inside one transaction and ROLLS BACK:
-- no production data is changed. Run: bash tests/rls/run.sh
BEGIN;
CREATE TEMP TABLE _r (name text, ok boolean);
GRANT ALL ON _r TO anon, authenticated;
SELECT set_config('rls.owner', (SELECT user_id::text FROM user_roles WHERE role='owner' LIMIT 1), true);

-- Reader B = the existing owner account acting as a normal reader (data rolled back).
-- Reader A = a uuid with no account (cannot be created here; auth schema is managed).
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', current_setting('rls.owner')::uuid, 'role','authenticated')::text, true);
INSERT INTO topic_notes(user_id, topic_id, body) SELECT auth.uid(), min(id), 'B private note' FROM content_topics WHERE status='published'
  ON CONFLICT (user_id, topic_id) DO UPDATE SET body = EXCLUDED.body;
INSERT INTO _r SELECT 'B can write own note', count(*) >= 1 FROM topic_notes WHERE user_id = auth.uid();
DO $$ BEGIN INSERT INTO topic_notes(user_id, topic_id) SELECT auth.uid(), max(id) FROM content_topics; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN UPDATE topic_notes SET body = repeat('x', 20001) WHERE user_id = auth.uid();
  INSERT INTO _r VALUES ('Oversized note rejected', false);
EXCEPTION WHEN check_violation THEN INSERT INTO _r VALUES ('Oversized note rejected', true); END $$;
DO $$ BEGIN DELETE FROM topic_reads WHERE user_id = auth.uid(); INSERT INTO _r VALUES ('Reads cannot be rewritten', false);
EXCEPTION WHEN insufficient_privilege THEN INSERT INTO _r VALUES ('Reads cannot be rewritten', true); END $$;
RESET ROLE;

-- ANON
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims','{"role":"anon"}', true);
INSERT INTO _r SELECT 'anon reads published topics', count(*) > 0 FROM content_topics;
INSERT INTO _r SELECT 'anon sees no drafts', count(*) = 0 FROM content_topics WHERE status <> 'published';
INSERT INTO _r SELECT 'anon sees only approved sources', count(*) = 0 FROM content_resources WHERE review_status <> 'approved';
DO $$ BEGIN PERFORM 1 FROM profiles; INSERT INTO _r VALUES ('anon blocked from profiles', false);
EXCEPTION WHEN insufficient_privilege THEN INSERT INTO _r VALUES ('anon blocked from profiles', true); END $$;
DO $$ BEGIN PERFORM 1 FROM topic_notes; INSERT INTO _r VALUES ('anon blocked from notes', false);
EXCEPTION WHEN insufficient_privilege THEN INSERT INTO _r VALUES ('anon blocked from notes', true); END $$;
DO $$ BEGIN PERFORM 1 FROM content_resource_private; INSERT INTO _r VALUES ('anon blocked from private source notes', false);
EXCEPTION WHEN insufficient_privilege THEN INSERT INTO _r VALUES ('anon blocked from private source notes', true); END $$;
RESET ROLE;

-- USER A
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-a000-00000000000a","role":"authenticated"}', true);
INSERT INTO _r SELECT 'A cannot read B notes', count(*) = 0 FROM topic_notes WHERE user_id = current_setting('rls.owner')::uuid;
INSERT INTO _r SELECT 'A cannot read B saves', count(*) = 0 FROM saved_topics WHERE user_id = current_setting('rls.owner')::uuid;
INSERT INTO _r SELECT 'A cannot read B interests', count(*) = 0 FROM user_interests WHERE user_id = current_setting('rls.owner')::uuid;
INSERT INTO _r SELECT 'A sees no other profiles', count(*) = 0 FROM profiles;
INSERT INTO _r SELECT 'A sees no private suggestion notes', count(*) = 0 FROM topic_suggestion_private;
INSERT INTO _r SELECT 'A is not editor', NOT public.is_editor();
WITH u AS (UPDATE topic_notes SET body = 'hacked' WHERE user_id = current_setting('rls.owner')::uuid RETURNING 1)
INSERT INTO _r SELECT 'A cannot edit B notes', count(*) = 0 FROM u;
DO $$ BEGIN INSERT INTO topic_notes(user_id, topic_id, body) SELECT current_setting('rls.owner')::uuid, min(id), 'x' FROM content_topics;
  INSERT INTO _r VALUES ('A cannot write notes as B', false);
EXCEPTION WHEN insufficient_privilege OR unique_violation THEN INSERT INTO _r VALUES ('A cannot write notes as B', true); END $$;
DO $$ BEGIN INSERT INTO user_roles(user_id, role) VALUES ('00000000-0000-4000-a000-00000000000a','owner');
  INSERT INTO _r VALUES ('A cannot grant self owner', false);
EXCEPTION WHEN insufficient_privilege THEN INSERT INTO _r VALUES ('A cannot grant self owner', true); END $$;
WITH u AS (UPDATE content_topics SET title = title WHERE true RETURNING 1)
INSERT INTO _r SELECT 'A cannot edit topics', count(*) = 0 FROM u;
RESET ROLE;

-- EDITOR / OWNER (existing owner account, read-only checks)
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', current_setting('rls.owner')::uuid, 'role','authenticated')::text, true);
INSERT INTO _r SELECT 'Owner is editor', public.is_editor();
INSERT INTO _r SELECT 'Owner sees all topics incl. drafts', count(*) = (SELECT count(*) FROM content_topics) FROM content_topics;
RESET ROLE;

-- Abort deliberately so nothing is ever kept; the summary is the error text.
DO $$ BEGIN RAISE EXCEPTION 'RLS_RESULTS passed=% failed=% :: %',
  (SELECT count(*) FILTER (WHERE ok) FROM _r), (SELECT count(*) FILTER (WHERE NOT ok) FROM _r),
  (SELECT string_agg(CASE WHEN ok THEN 'PASS ' ELSE 'FAIL ' END || name, ' | ' ORDER BY ok, name) FROM _r); END $$;
ROLLBACK;
