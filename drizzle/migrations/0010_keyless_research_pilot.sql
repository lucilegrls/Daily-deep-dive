CREATE TABLE IF NOT EXISTS public.research_pilot (
  id int PRIMARY KEY CHECK (id = 1),
  provider text NOT NULL DEFAULT 'tavily-keyless',
  search_cap int NOT NULL DEFAULT 20, extract_cap int NOT NULL DEFAULT 20, call_cap int NOT NULL DEFAULT 40,
  searches_used int NOT NULL DEFAULT 0, extracts_used int NOT NULL DEFAULT 0, calls_attempted int NOT NULL DEFAULT 0,
  external_smoke_calls int NOT NULL DEFAULT 0,
  topic_ids int[] NOT NULL DEFAULT '{}',
  state text NOT NULL DEFAULT 'ready' CHECK (state IN ('ready','running','complete','stopped_quota','stopped_error','stopped_budget')),
  stop_reason text, in_flight_until timestamptz NOT NULL DEFAULT 'epoch', updated_at timestamptz NOT NULL DEFAULT now()
);
-- The owner's two keyless smoke calls (1 search + 1 extract) made outside the app count against the 40-call cap.
INSERT INTO public.research_pilot (id, calls_attempted, searches_used, extracts_used, external_smoke_calls) VALUES (1, 2, 1, 1, 2) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.research_pilot_calls (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('search','extract')),
  topic_id int, purpose text NOT NULL DEFAULT 'pilot' CHECK (purpose IN ('pilot','smoke')),
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved','ok','partial','failed','quota')),
  http_status int, provider_request_id text, url_count int NOT NULL DEFAULT 0,
  reserved_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz
);
CREATE TABLE IF NOT EXISTS public.research_pilot_topics (
  topic_id int PRIMARY KEY REFERENCES public.content_topics(id),
  position int NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','searched','done','blocked')),
  query text, note text, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.research_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id int NOT NULL REFERENCES public.content_topics(id),
  url text NOT NULL, dedup_key text NOT NULL, host text NOT NULL,
  title text, snippet text, search_score real, authority text NOT NULL,
  existing_resource_id uuid, search_call_id bigint REFERENCES public.research_pilot_calls(id),
  selected_for_extract boolean NOT NULL DEFAULT false,
  blocked_checks text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'suggested' CHECK (status = 'suggested'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (topic_id, dedup_key)
);
CREATE TABLE IF NOT EXISTS public.research_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id int NOT NULL REFERENCES public.content_topics(id),
  candidate_id uuid REFERENCES public.research_candidates(id),
  url text NOT NULL, returned_url text, dedup_key text NOT NULL,
  provider text NOT NULL DEFAULT 'tavily-keyless', provider_request_id text, extract_call_id bigint REFERENCES public.research_pilot_calls(id),
  retrieved_at timestamptz NOT NULL DEFAULT now(),
  inspected_method text NOT NULL DEFAULT 'machine_extracted_text' CHECK (inspected_method = 'machine_extracted_text'),
  outcome text NOT NULL CHECK (outcome IN ('full','truncated','partial','failed')),
  text_content text CHECK (char_length(text_content) <= 20000),
  excerpt text CHECK (char_length(excerpt) <= 600),
  original_chars int, stored_chars int, truncated boolean NOT NULL DEFAULT false,
  content_hash text, failure_reason text,
  UNIQUE (topic_id, dedup_key)
);
GRANT SELECT ON public.research_pilot, public.research_pilot_calls, public.research_pilot_topics TO authenticated;
GRANT SELECT, INSERT ON public.research_candidates, public.research_evidence TO authenticated;
GRANT UPDATE (status, query, note, updated_at) ON public.research_pilot_topics TO authenticated;
GRANT ALL ON public.research_pilot, public.research_pilot_calls, public.research_pilot_topics, public.research_candidates, public.research_evidence TO service_role;
ALTER TABLE public.research_pilot ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_pilot_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_pilot_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_evidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY rp_read ON public.research_pilot FOR SELECT TO authenticated USING (public.is_editor());
CREATE POLICY rpc_read ON public.research_pilot_calls FOR SELECT TO authenticated USING (public.is_editor());
CREATE POLICY rpt_read ON public.research_pilot_topics FOR SELECT TO authenticated USING (public.is_editor());
CREATE POLICY rpt_update ON public.research_pilot_topics FOR UPDATE TO authenticated USING (public.is_editor()) WITH CHECK (public.is_editor());
CREATE POLICY rc_read ON public.research_candidates FOR SELECT TO authenticated USING (public.is_editor());
CREATE POLICY rc_insert ON public.research_candidates FOR INSERT TO authenticated WITH CHECK (public.is_editor());
CREATE POLICY re_read ON public.research_evidence FOR SELECT TO authenticated USING (public.is_editor());
CREATE POLICY re_insert ON public.research_evidence FOR INSERT TO authenticated WITH CHECK (public.is_editor());

-- Fixes the 10 topics once; never reselects or resets.
CREATE OR REPLACE FUNCTION public.init_research_pilot() RETURNS int[]
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ids int[];
BEGIN
  IF NOT (public.is_editor() OR auth.role() = 'service_role') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT topic_ids INTO ids FROM research_pilot WHERE id = 1 FOR UPDATE;
  IF cardinality(ids) > 0 THEN RETURN ids; END IF;
  SELECT array_agg(id ORDER BY id) INTO ids FROM (
    SELECT t.id FROM content_topics t WHERE t.status = 'published'
      AND NOT EXISTS (SELECT 1 FROM resource_verification_log l WHERE l.topic_id = t.id AND l.outcome = 'passing')
    ORDER BY t.id LIMIT 10) s;
  UPDATE research_pilot SET topic_ids = ids, updated_at = now() WHERE id = 1;
  INSERT INTO research_pilot_topics (topic_id, position) SELECT x, o FROM unnest(ids) WITH ORDINALITY u(x, o) ON CONFLICT DO NOTHING;
  RETURN ids;
END $$;

-- Atomic budget reservation BEFORE any provider call. One in flight; hard caps; no reset path.
CREATE OR REPLACE FUNCTION public.reserve_research_call(_kind text, _topic int, _purpose text, _url_count int) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p research_pilot; cid bigint;
BEGIN
  IF NOT (public.is_editor() OR auth.role() = 'service_role') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _kind NOT IN ('search','extract') OR _purpose NOT IN ('pilot','smoke') THEN RAISE EXCEPTION 'invalid'; END IF;
  IF _kind = 'extract' AND (_url_count < 1 OR _url_count > 5) THEN RAISE EXCEPTION 'extract_url_limit'; END IF;
  IF _topic IS NOT NULL AND NOT EXISTS (SELECT 1 FROM research_pilot_topics WHERE topic_id = _topic) THEN RAISE EXCEPTION 'topic_not_in_pilot'; END IF;
  SELECT * INTO p FROM research_pilot WHERE id = 1 FOR UPDATE;
  IF p.state LIKE 'stopped%' OR p.state = 'complete' THEN RAISE EXCEPTION 'pilot_stopped'; END IF;
  IF p.in_flight_until > now() THEN RAISE EXCEPTION 'busy'; END IF;
  IF p.calls_attempted >= p.call_cap
     OR (_kind = 'search' AND p.searches_used >= p.search_cap)
     OR (_kind = 'extract' AND p.extracts_used >= p.extract_cap) THEN
    UPDATE research_pilot SET state = 'stopped_budget', stop_reason = 'budget cap reached', updated_at = now() WHERE id = 1;
    RAISE EXCEPTION 'budget_exhausted';
  END IF;
  UPDATE research_pilot SET calls_attempted = calls_attempted + 1,
    searches_used = searches_used + (_kind = 'search')::int, extracts_used = extracts_used + (_kind = 'extract')::int,
    in_flight_until = now() + interval '45 seconds', state = 'running', updated_at = now() WHERE id = 1;
  INSERT INTO research_pilot_calls (kind, topic_id, purpose, url_count) VALUES (_kind, _topic, _purpose, _url_count) RETURNING id INTO cid;
  RETURN cid;
END $$;

CREATE OR REPLACE FUNCTION public.finish_research_call(_id bigint, _status text, _http int, _request_id text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.is_editor() OR auth.role() = 'service_role') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _status NOT IN ('ok','partial','failed','quota') THEN RAISE EXCEPTION 'invalid'; END IF;
  UPDATE research_pilot_calls SET status = _status, http_status = _http, provider_request_id = left(_request_id, 120), finished_at = now()
    WHERE id = _id AND status = 'reserved';
  UPDATE research_pilot SET in_flight_until = 'epoch', updated_at = now(),
    state = CASE WHEN _status = 'quota' THEN 'stopped_quota' ELSE state END,
    stop_reason = CASE WHEN _status = 'quota' THEN 'provider returned HTTP ' || coalesce(_http::text,'?') || '; stopped, no upgrade' ELSE stop_reason END
    WHERE id = 1;
END $$;

CREATE OR REPLACE FUNCTION public.complete_research_pilot() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.is_editor() OR auth.role() = 'service_role') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE research_pilot SET state = 'complete', in_flight_until = 'epoch', updated_at = now()
   WHERE id = 1 AND state IN ('ready','running')
     AND NOT EXISTS (SELECT 1 FROM research_pilot_topics WHERE status IN ('pending','searched'));
END $$;

REVOKE ALL ON FUNCTION public.init_research_pilot(), public.reserve_research_call(text,int,text,int), public.finish_research_call(bigint,text,int,text), public.complete_research_pilot() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.init_research_pilot(), public.reserve_research_call(text,int,text,int), public.finish_research_call(bigint,text,int,text), public.complete_research_pilot() TO authenticated, service_role;