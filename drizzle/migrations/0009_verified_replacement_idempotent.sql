ALTER TABLE public.resource_verification_log ADD COLUMN IF NOT EXISTS evidence_json jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.source_replacements (
  idempotency_key text PRIMARY KEY CHECK (length(idempotency_key) BETWEEN 8 AND 200),
  old_resource_id uuid NOT NULL UNIQUE REFERENCES public.content_resources(id) ON DELETE CASCADE,
  new_resource_id uuid NOT NULL REFERENCES public.content_resources(id) ON DELETE CASCADE,
  outcome text NOT NULL,
  evidence jsonb NOT NULL,
  page_inspected boolean NOT NULL,
  run_source text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.source_replacements TO authenticated;
GRANT ALL ON public.source_replacements TO service_role;
ALTER TABLE public.source_replacements ENABLE ROW LEVEL SECURITY;
CREATE POLICY replacements_editor_read ON public.source_replacements FOR SELECT TO authenticated USING (public.is_editor());
CREATE POLICY replacements_editor_insert ON public.source_replacements FOR INSERT TO authenticated WITH CHECK (public.is_editor());

-- Retire the prose-evidence version.
CREATE OR REPLACE FUNCTION public.apply_source_replacement(
  _old uuid, _kind text, _title text, _url text, _creator text, _evidence text, _run_source text
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'retired: use apply_verified_replacement'; END $$;
REVOKE EXECUTE ON FUNCTION public.apply_source_replacement(uuid,text,text,text,text,text,text) FROM authenticated;

/*
 _evidence shape (validated):
 { "outcome": "passing"|"exceptional",
   "inspection": { "method": "page_read"|"video_watched"|"transcript_read"|"metadata_only", "inspected_at": "YYYY-MM-DD", "url": "<replacement url>" },
   "checks": { ... recorded rule checks ... },
   "missing": [rule names], "unknown": [rule names], "exceptionReason": text|null }
*/
CREATE OR REPLACE FUNCTION public.apply_verified_replacement(
  _old uuid, _expected_updated_at timestamptz, _idempotency_key text,
  _replacement jsonb, _evidence jsonb, _run_source text
) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  _prev public.source_replacements%ROWTYPE;
  _o record; _new uuid;
  _method text := _evidence #>> '{inspection,method}';
  _outcome text := _evidence ->> 'outcome';
  _missing jsonb := coalesce(_evidence -> 'missing', 'null');
  _unknown jsonb := coalesce(_evidence -> 'unknown', 'null');
  _reason text := nullif(btrim(coalesce(_evidence ->> 'exceptionReason', '')), '');
  _url text := btrim(coalesce(_replacement ->> 'url', ''));
  _title text := btrim(coalesce(_replacement ->> 'title', ''));
  _kind text := _replacement ->> 'kind';
  _inspected boolean;
BEGIN
  IF NOT (public.is_editor() OR auth.role() = 'service_role') THEN RAISE EXCEPTION 'forbidden'; END IF;

  -- Idempotent retry: same key returns the earlier result, never a second row.
  SELECT * INTO _prev FROM source_replacements WHERE idempotency_key = _idempotency_key;
  IF FOUND THEN
    IF _prev.old_resource_id <> _old THEN RAISE EXCEPTION 'idempotency_key_reused'; END IF;
    RETURN _prev.new_resource_id;
  END IF;

  -- Structured evidence validation.
  IF jsonb_typeof(_evidence) <> 'object' OR jsonb_typeof(_evidence -> 'checks') IS DISTINCT FROM 'object'
     OR jsonb_typeof(_missing) <> 'array' OR jsonb_typeof(_unknown) <> 'array' THEN
    RAISE EXCEPTION 'evidence_malformed';
  END IF;
  IF _method NOT IN ('page_read','video_watched','transcript_read','metadata_only') OR _method IS NULL THEN
    RAISE EXCEPTION 'inspection_method_invalid';
  END IF;
  _inspected := _method <> 'metadata_only';
  IF NOT _inspected THEN RAISE EXCEPTION 'inspection_required: metadata-only evidence cannot publish a replacement'; END IF;
  IF (_evidence #>> '{inspection,inspected_at}') !~ '^\d{4}-\d{2}-\d{2}$' THEN RAISE EXCEPTION 'inspection_date_missing'; END IF;
  IF (_evidence #>> '{inspection,url}') IS DISTINCT FROM _url THEN RAISE EXCEPTION 'inspection_url_mismatch'; END IF;
  IF jsonb_array_length(_unknown) > 0 THEN RAISE EXCEPTION 'unverified_checks_remain'; END IF;
  IF _outcome = 'passing' THEN
    IF jsonb_array_length(_missing) <> 0 THEN RAISE EXCEPTION 'passing_with_missing_rules'; END IF;
  ELSIF _outcome = 'exceptional' THEN
    IF jsonb_array_length(_missing) <> 1 OR _reason IS NULL THEN RAISE EXCEPTION 'exception_needs_one_rule_and_reason'; END IF;
  ELSE
    RAISE EXCEPTION 'outcome_not_publishable';
  END IF;
  IF _title = '' OR NOT public.is_safe_source_url(_url) OR _url ~* 'wiki(pedia|wand)\.' THEN RAISE EXCEPTION 'replacement_invalid'; END IF;

  -- Concurrency + owner-edit protection.
  SELECT id, topic_id, kind, review_status, updated_at INTO _o FROM content_resources WHERE id = _old FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'missing_source'; END IF;
  IF _o.updated_at IS DISTINCT FROM _expected_updated_at THEN RAISE EXCEPTION 'stale_version: source changed since evaluation'; END IF;
  IF _o.review_status = 'rejected' THEN RAISE EXCEPTION 'already_rejected'; END IF;
  IF _o.kind IS DISTINCT FROM _kind THEN RAISE EXCEPTION 'replacement_must_be_same_kind'; END IF;
  IF EXISTS (SELECT 1 FROM source_replacements WHERE old_resource_id = _old) THEN RAISE EXCEPTION 'already_replaced'; END IF;

  INSERT INTO content_resources(topic_id, kind, title, url, creator, author, publication, published_at,
    review_status, origin, needs_review, verification, position)
  VALUES (_o.topic_id, _kind, _title, _url, _replacement ->> 'creator', _replacement ->> 'author',
    _replacement ->> 'publication', nullif(_replacement ->> 'published_at','')::timestamptz,
    'approved', 'verification-replacement', false,
    jsonb_build_object('outcome', _outcome, 'inspection', _evidence -> 'inspection', 'checks', _evidence -> 'checks',
      'missing', _missing, 'unknown', _unknown, 'exceptionReason', _reason, 'replaces', _old),
    COALESCE((SELECT max(position)+1 FROM content_resources WHERE topic_id = _o.topic_id), 0))
  RETURNING id INTO _new;

  -- Old row: status only; its verification JSON and evidence are untouched.
  UPDATE content_resources SET review_status = 'rejected' WHERE id = _old;

  INSERT INTO source_replacements(idempotency_key, old_resource_id, new_resource_id, outcome, evidence, page_inspected, run_source)
  VALUES (_idempotency_key, _old, _new, _outcome, _evidence, _inspected, _run_source);
  UPDATE replacement_gaps SET status='resolved', replacement_id=_new, resolved_at=now() WHERE resource_id=_old;

  INSERT INTO resource_verification_log(resource_id, topic_id, outcome, failed_rules, evidence, evidence_json, page_inspected, action, run_source)
  VALUES (_old, _o.topic_id, 'rejected', '{}', 'old source archived after verified same-kind replacement',
    jsonb_build_object('replaced_by', _new), false, 'archived_replaced_by:' || _new::text, _run_source);
  INSERT INTO resource_verification_log(resource_id, topic_id, outcome, failed_rules, exception_reason, evidence, evidence_json, page_inspected, action, run_source)
  VALUES (_new, _o.topic_id, _outcome, ARRAY(SELECT jsonb_array_elements_text(_missing)), _reason,
    'replacement inspected: ' || _method, _evidence, _inspected, 'published_replacing:' || _old::text, _run_source);
  RETURN _new;
END $$;
REVOKE ALL ON FUNCTION public.apply_verified_replacement(uuid,timestamptz,text,jsonb,jsonb,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_verified_replacement(uuid,timestamptz,text,jsonb,jsonb,text) TO authenticated, service_role;