-- apply_verified_replacement safety tests. Runs as one block that ALWAYS
-- aborts itself, so the test topic/rows/logs it creates are rolled back and no
-- catalogue record is changed. Run with a privileged SQL session; the result is
-- the error message "REPLACEMENT_RESULTS passed=N failed=0".
DO $$
DECLARE _summary text; _topic int; _old uuid; _ver timestamptz; _n1 uuid; _n2 uuid; _ev jsonb; _rep jsonb;
BEGIN
  CREATE TEMP TABLE t_res(name text, ok boolean);
  INSERT INTO content_topics(id, slug, title, category, context, takeaways, tags, related_ids, status, origin, search_text)
  VALUES ((SELECT max(id)+1000 FROM content_topics), 'zz-replacement-test', 'ZZ test', 'Science', 'test', '{}', '{}', '{}', 'draft', 'manual', '')
  RETURNING id INTO _topic;
  INSERT INTO content_resources(topic_id, kind, title, url, review_status, origin, verification, position)
  VALUES (_topic, 'videos', 'Old', 'https://www.youtube.com/watch?v=zzold', 'approved', 'manual', '{"reviewLevel":"kept"}', 0)
  RETURNING id, updated_at INTO _old, _ver;

  _rep := '{"kind":"videos","title":"New","url":"https://www.youtube.com/watch?v=zznew","creator":"HHMI"}';
  _ev := '{"outcome":"passing","inspection":{"method":"video_watched","inspected_at":"2026-10-20","url":"https://www.youtube.com/watch?v=zznew"},"checks":{"topicFit":true},"missing":[],"unknown":[]}';

  GRANT ALL ON t_res TO authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', (SELECT user_id FROM user_roles WHERE role='owner' LIMIT 1), 'role','authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);
  -- prose / metadata-only / unknown checks / wrong kind / stale version are refused
  BEGIN PERFORM apply_verified_replacement(_old, _ver, 'key-prose-01', _rep, '"I read it"'::jsonb, 't');
    INSERT INTO t_res VALUES ('prose refused', false); EXCEPTION WHEN others THEN INSERT INTO t_res VALUES ('prose refused', true); END;
  BEGIN PERFORM apply_verified_replacement(_old, _ver, 'key-meta-01', _rep, jsonb_set(_ev, '{inspection,method}', '"metadata_only"'), 't');
    INSERT INTO t_res VALUES ('metadata-only refused', false); EXCEPTION WHEN others THEN INSERT INTO t_res VALUES ('metadata-only refused', true); END;
  BEGIN PERFORM apply_verified_replacement(_old, _ver, 'key-unk-01', _rep, jsonb_set(_ev, '{unknown}', '["depth"]'), 't');
    INSERT INTO t_res VALUES ('unknown checks refused', false); EXCEPTION WHEN others THEN INSERT INTO t_res VALUES ('unknown checks refused', true); END;
  BEGIN PERFORM apply_verified_replacement(_old, _ver, 'key-exc-01', _rep, jsonb_set(jsonb_set(_ev, '{outcome}', '"exceptional"'), '{missing}', '["depth"]'), 't');
    INSERT INTO t_res VALUES ('exception without reason refused', false); EXCEPTION WHEN others THEN INSERT INTO t_res VALUES ('exception without reason refused', true); END;
  BEGIN PERFORM apply_verified_replacement(_old, _ver, 'key-kind-01', jsonb_set(_rep, '{kind}', '"articles"'), _ev, 't');
    INSERT INTO t_res VALUES ('different kind refused', false); EXCEPTION WHEN others THEN INSERT INTO t_res VALUES ('different kind refused', true); END;
  BEGIN PERFORM apply_verified_replacement(_old, _ver - interval '1 second', 'key-stale-01', _rep, _ev, 't');
    INSERT INTO t_res VALUES ('stale version refused', false); EXCEPTION WHEN others THEN INSERT INTO t_res VALUES ('stale version refused', true); END;

  _n1 := apply_verified_replacement(_old, _ver, 'key-good-01', _rep, _ev, 't');
  _n2 := apply_verified_replacement(_old, _ver, 'key-good-01', _rep, _ev, 't');
  INSERT INTO t_res VALUES ('retry is idempotent', _n1 = _n2 AND (SELECT count(*) FROM content_resources WHERE topic_id=_topic) = 2);
  INSERT INTO t_res VALUES ('old archived, verification kept',
    (SELECT review_status='rejected' AND verification = '{"reviewLevel":"kept"}' FROM content_resources WHERE id=_old));
  INSERT INTO t_res VALUES ('new row approved same kind', (SELECT review_status='approved' AND kind='videos' FROM content_resources WHERE id=_n1));
  INSERT INTO t_res VALUES ('both decisions logged, inspected stamped',
    (SELECT count(*) = 2 AND bool_or(page_inspected AND resource_id=_n1) AND NOT bool_or(page_inspected AND resource_id=_old)
       FROM resource_verification_log WHERE topic_id=_topic));
  BEGIN PERFORM apply_verified_replacement(_old, _ver, 'key-other-01', _rep, _ev, 't');
    INSERT INTO t_res VALUES ('second key refused', false); EXCEPTION WHEN others THEN INSERT INTO t_res VALUES ('second key refused', true); END;
  SELECT 'REPLACEMENT_RESULTS passed=' || count(*) FILTER (WHERE ok) || ' failed=' || count(*) FILTER (WHERE NOT ok)
    || ' ' || coalesce(string_agg(name, '; ') FILTER (WHERE NOT ok), '') INTO _summary FROM t_res;
  -- Abort on purpose: everything above (test topic, rows, logs) is rolled back.
  RAISE EXCEPTION '%', _summary;
END $$;
