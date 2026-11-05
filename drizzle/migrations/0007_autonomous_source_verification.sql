CREATE TABLE IF NOT EXISTS public.resource_verification_log (
  id bigserial PRIMARY KEY,
  resource_id uuid NOT NULL REFERENCES public.content_resources(id) ON DELETE CASCADE,
  topic_id integer NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('passing','exceptional','blocked','rejected')),
  failed_rules text[] NOT NULL DEFAULT '{}',
  exception_reason text,
  evidence text NOT NULL,
  page_inspected boolean NOT NULL DEFAULT false,
  action text NOT NULL,
  run_source text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rvl_resource_idx ON public.resource_verification_log(resource_id, created_at DESC);
GRANT SELECT, INSERT ON public.resource_verification_log TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.resource_verification_log_id_seq TO authenticated;
GRANT ALL ON public.resource_verification_log TO service_role;
GRANT ALL ON SEQUENCE public.resource_verification_log_id_seq TO service_role;
ALTER TABLE public.resource_verification_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY rvl_editor_read ON public.resource_verification_log FOR SELECT TO authenticated USING (public.is_editor());
CREATE POLICY rvl_editor_insert ON public.resource_verification_log FOR INSERT TO authenticated WITH CHECK (public.is_editor());

CREATE TABLE IF NOT EXISTS public.replacement_gaps (
  resource_id uuid PRIMARY KEY REFERENCES public.content_resources(id) ON DELETE CASCADE,
  topic_id integer NOT NULL,
  reason text NOT NULL,
  blocker text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  replacement_id uuid,
  opened_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
GRANT SELECT, INSERT, UPDATE ON public.replacement_gaps TO authenticated;
GRANT ALL ON public.replacement_gaps TO service_role;
ALTER TABLE public.replacement_gaps ENABLE ROW LEVEL SECURITY;
CREATE POLICY gaps_editor_all ON public.replacement_gaps FOR ALL TO authenticated USING (public.is_editor()) WITH CHECK (public.is_editor());

CREATE TABLE IF NOT EXISTS public.verification_cursor (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last_resource_id uuid,
  passes integer NOT NULL DEFAULT 0,
  lease_until timestamptz NOT NULL DEFAULT 'epoch',
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.verification_cursor(id) VALUES (1) ON CONFLICT DO NOTHING;
GRANT SELECT, UPDATE ON public.verification_cursor TO authenticated;
GRANT ALL ON public.verification_cursor TO service_role;
ALTER TABLE public.verification_cursor ENABLE ROW LEVEL SECURITY;
CREATE POLICY cursor_editor_all ON public.verification_cursor FOR ALL TO authenticated USING (public.is_editor()) WITH CHECK (public.is_editor());

-- Atomic replacement: publish the verified replacement and archive the old source in one transaction.
CREATE OR REPLACE FUNCTION public.apply_source_replacement(
  _old uuid, _kind text, _title text, _url text, _creator text, _evidence text, _run_source text
) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE _topic integer; _new uuid;
BEGIN
  IF NOT (public.is_editor() OR auth.role() = 'service_role') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF NOT public.is_safe_source_url(_url) OR _url ~* 'wikipedia\.org' THEN RAISE EXCEPTION 'unsafe_url'; END IF;
  SELECT topic_id INTO _topic FROM content_resources WHERE id = _old FOR UPDATE;
  IF _topic IS NULL THEN RAISE EXCEPTION 'missing_source'; END IF;
  INSERT INTO content_resources(topic_id, kind, title, url, creator, review_status, origin, needs_review,
    verification, position)
  VALUES (_topic, _kind, _title, _url, _creator, 'approved', 'verification-replacement', false,
    jsonb_build_object('reviewLevel', _evidence, 'checkedAt', current_date),
    COALESCE((SELECT max(position)+1 FROM content_resources WHERE topic_id=_topic),0))
  RETURNING id INTO _new;
  UPDATE content_resources SET review_status='rejected', needs_review=false,
    needs_review_reason='replaced by '||_new::text WHERE id=_old;
  UPDATE replacement_gaps SET status='resolved', replacement_id=_new, resolved_at=now() WHERE resource_id=_old;
  INSERT INTO resource_verification_log(resource_id, topic_id, outcome, evidence, page_inspected, action, run_source)
  VALUES (_old, _topic, 'rejected', _evidence, true, 'replaced:'||_new::text, _run_source);
  RETURN _new;
END $$;
REVOKE ALL ON FUNCTION public.apply_source_replacement(uuid,text,text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_source_replacement(uuid,text,text,text,text,text,text) TO authenticated, service_role;