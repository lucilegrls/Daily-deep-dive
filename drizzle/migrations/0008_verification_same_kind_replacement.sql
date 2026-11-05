ALTER TABLE public.verification_cursor
  ADD COLUMN IF NOT EXISTS scheduler_state text NOT NULL DEFAULT 'paused',
  ADD COLUMN IF NOT EXISTS scheduler_note text NOT NULL DEFAULT 'Hourly schedule paused: the live site does not contain the verification route yet. Re-enable only after publishing and a successful authenticated test call.';
UPDATE public.verification_cursor SET scheduler_state='paused' WHERE id=1;

CREATE OR REPLACE FUNCTION public.apply_source_replacement(
  _old uuid, _kind text, _title text, _url text, _creator text, _evidence text, _run_source text
) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE _topic integer; _old_kind text; _new uuid;
BEGIN
  IF NOT (public.is_editor() OR auth.role() = 'service_role') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF NOT public.is_safe_source_url(_url) OR _url ~* 'wikipedia\.org' THEN RAISE EXCEPTION 'unsafe_url'; END IF;
  IF coalesce(_evidence,'') = '' THEN RAISE EXCEPTION 'evidence_required'; END IF;
  SELECT topic_id, kind INTO _topic, _old_kind FROM content_resources WHERE id = _old FOR UPDATE;
  IF _topic IS NULL THEN RAISE EXCEPTION 'missing_source'; END IF;
  IF _old_kind IS DISTINCT FROM _kind THEN RAISE EXCEPTION 'replacement_must_be_same_kind'; END IF;
  INSERT INTO content_resources(topic_id, kind, title, url, creator, review_status, origin, needs_review, verification, position)
  VALUES (_topic, _kind, _title, _url, _creator, 'approved', 'verification-replacement', false,
    jsonb_build_object('reviewLevel', _evidence, 'checkedAt', current_date, 'replaces', _old),
    COALESCE((SELECT max(position)+1 FROM content_resources WHERE topic_id=_topic),0))
  RETURNING id INTO _new;
  -- Old row keeps its verification JSON untouched; only its status changes.
  UPDATE content_resources SET review_status='rejected' WHERE id=_old;
  UPDATE replacement_gaps SET status='resolved', replacement_id=_new, resolved_at=now() WHERE resource_id=_old;
  INSERT INTO resource_verification_log(resource_id, topic_id, outcome, evidence, page_inspected, action, run_source)
  VALUES (_old, _topic, 'rejected', _evidence, true, 'replaced:'||_new::text, _run_source);
  RETURN _new;
END $$;