-- Curiosity, Sourced resource health and trust model.
-- Additive and idempotent. Technical checks, human source reviews and claim
-- reviews are intentionally stored in different tables.

ALTER TABLE public.content_topics
  ADD COLUMN IF NOT EXISTS risk_level text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS jurisdiction text,
  ADD COLUMN IF NOT EXISTS temporal_scope text,
  ADD COLUMN IF NOT EXISTS last_editorial_review_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_editorial_review_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS editorial_review_reason text,
  ADD COLUMN IF NOT EXISTS editorial_reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

DO $$ BEGIN
  ALTER TABLE public.content_topics ADD CONSTRAINT content_topics_risk_level_check
    CHECK (risk_level IN ('standard','elevated','high'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.content_resources
  ADD COLUMN IF NOT EXISTS normalized_url text,
  ADD COLUMN IF NOT EXISTS final_url text,
  ADD COLUMN IF NOT EXISTS source_domain text,
  ADD COLUMN IF NOT EXISTS response_time_ms integer,
  ADD COLUMN IF NOT EXISTS mime_type text,
  ADD COLUMN IF NOT EXISTS technical_status text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS embed_status text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS last_successful_check_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_failed_check_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_embed_check_at timestamptz;

DO $$ BEGIN
  ALTER TABLE public.content_resources ADD CONSTRAINT content_resources_technical_status_check CHECK
    (technical_status IN ('healthy','redirected','restricted','paywalled','embed_unavailable',
      'temporarily_unavailable','broken','removed','needs_review','unknown'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.content_resources ADD CONSTRAINT content_resources_embed_status_check CHECK
    (embed_status IN ('available','unavailable','restricted','unknown','not_applicable'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.content_resources ADD CONSTRAINT content_resources_response_time_check CHECK
    (response_time_ms IS NULL OR response_time_ms >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.resource_technical_checks (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  resource_id uuid NOT NULL REFERENCES public.content_resources(id) ON DELETE RESTRICT,
  run_id uuid NOT NULL DEFAULT gen_random_uuid(),
  checked_at timestamptz NOT NULL DEFAULT now(),
  check_type text NOT NULL DEFAULT 'scheduled' CHECK (check_type IN ('scheduled','editor_retry','backfill')),
  original_url text NOT NULL,
  normalized_url text,
  status_code integer,
  redirect_chain jsonb NOT NULL DEFAULT '[]'::jsonb,
  final_url text,
  source_domain text,
  response_time_ms integer CHECK (response_time_ms IS NULL OR response_time_ms >= 0),
  content_type text,
  technical_status text NOT NULL CHECK (technical_status IN ('healthy','redirected','restricted','paywalled',
    'embed_unavailable','temporarily_unavailable','broken','removed','needs_review','unknown')),
  embed_status text NOT NULL DEFAULT 'unknown' CHECK (embed_status IN ('available','unavailable','restricted','unknown','not_applicable')),
  auth_required boolean,
  paywall_detected boolean,
  destination_changed boolean,
  failure_reason text,
  checker_version text NOT NULL,
  observation jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS resource_technical_checks_resource_time_idx
  ON public.resource_technical_checks(resource_id, checked_at DESC);
CREATE INDEX IF NOT EXISTS resource_technical_checks_status_time_idx
  ON public.resource_technical_checks(technical_status, checked_at DESC);

CREATE TABLE IF NOT EXISTS public.resource_check_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (source IN ('scheduled','editor','backfill')),
  checker_version text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  attempted integer NOT NULL DEFAULT 0,
  succeeded integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0,
  timed_out integer NOT NULL DEFAULT 0,
  rate_limited integer NOT NULL DEFAULT 0,
  redirected integer NOT NULL DEFAULT 0,
  embed_failures integer NOT NULL DEFAULT 0,
  average_response_ms integer,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','failed')),
  error_detail text
);

CREATE TABLE IF NOT EXISTS public.resource_editorial_reviews (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  resource_id uuid NOT NULL REFERENCES public.content_resources(id) ON DELETE RESTRICT,
  reviewer uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  decision text NOT NULL CHECK (decision IN ('approved','limited','rejected','replacement_needed','temporarily_unavailable','no_replacement')),
  identity_checked boolean NOT NULL DEFAULT false,
  relevance_checked boolean NOT NULL DEFAULT false,
  credibility_checked boolean NOT NULL DEFAULT false,
  coverage_checked boolean NOT NULL DEFAULT false,
  notes text,
  limitations text,
  jurisdiction text,
  as_of_date date
);
CREATE INDEX IF NOT EXISTS resource_editorial_reviews_resource_time_idx
  ON public.resource_editorial_reviews(resource_id, reviewed_at DESC);

CREATE TABLE IF NOT EXISTS public.topic_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id integer NOT NULL REFERENCES public.content_topics(id) ON DELETE RESTRICT,
  claim_text text NOT NULL CHECK (char_length(btrim(claim_text)) BETWEEN 1 AND 4000),
  location_hint text,
  status text NOT NULL DEFAULT 'unreviewed' CHECK (status IN ('unreviewed','supported','qualified','unsupported','disputed','outdated')),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS topic_claims_topic_status_idx ON public.topic_claims(topic_id, status);

CREATE TABLE IF NOT EXISTS public.claim_supporting_resources (
  claim_id uuid NOT NULL REFERENCES public.topic_claims(id) ON DELETE CASCADE,
  resource_id uuid NOT NULL REFERENCES public.content_resources(id) ON DELETE RESTRICT,
  evidence_locator text,
  notes text,
  PRIMARY KEY (claim_id, resource_id)
);

CREATE TABLE IF NOT EXISTS public.claim_editorial_reviews (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  claim_id uuid NOT NULL REFERENCES public.topic_claims(id) ON DELETE RESTRICT,
  reviewer uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  decision text NOT NULL CHECK (decision IN ('supported','qualified','unsupported','disputed','outdated')),
  evidence_summary text NOT NULL,
  limitations text
);
CREATE INDEX IF NOT EXISTS claim_editorial_reviews_claim_time_idx
  ON public.claim_editorial_reviews(claim_id, reviewed_at DESC);

ALTER TABLE public.resource_technical_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_check_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_editorial_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topic_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claim_supporting_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claim_editorial_reviews ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON public.resource_technical_checks, public.resource_check_runs,
  public.resource_editorial_reviews, public.topic_claims, public.claim_supporting_resources,
  public.claim_editorial_reviews TO authenticated;
GRANT UPDATE ON public.resource_check_runs, public.topic_claims TO authenticated;
GRANT ALL ON public.resource_technical_checks, public.resource_check_runs,
  public.resource_editorial_reviews, public.topic_claims, public.claim_supporting_resources,
  public.claim_editorial_reviews TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.resource_technical_checks_id_seq,
  public.resource_editorial_reviews_id_seq, public.claim_editorial_reviews_id_seq
  TO authenticated, service_role;

DROP POLICY IF EXISTS technical_checks_editor_read ON public.resource_technical_checks;
CREATE POLICY technical_checks_editor_read ON public.resource_technical_checks FOR SELECT TO authenticated USING (public.is_editor());
DROP POLICY IF EXISTS technical_checks_editor_insert ON public.resource_technical_checks;
CREATE POLICY technical_checks_editor_insert ON public.resource_technical_checks FOR INSERT TO authenticated WITH CHECK (public.is_editor());
DROP POLICY IF EXISTS check_runs_editor_all ON public.resource_check_runs;
CREATE POLICY check_runs_editor_all ON public.resource_check_runs FOR ALL TO authenticated USING (public.is_editor()) WITH CHECK (public.is_editor());
DROP POLICY IF EXISTS resource_reviews_editor_read ON public.resource_editorial_reviews;
CREATE POLICY resource_reviews_editor_read ON public.resource_editorial_reviews FOR SELECT TO authenticated USING (public.is_editor());
DROP POLICY IF EXISTS resource_reviews_editor_insert ON public.resource_editorial_reviews;
CREATE POLICY resource_reviews_editor_insert ON public.resource_editorial_reviews FOR INSERT TO authenticated WITH CHECK (public.is_editor() AND reviewer = auth.uid());
DROP POLICY IF EXISTS topic_claims_editor_all ON public.topic_claims;
CREATE POLICY topic_claims_editor_all ON public.topic_claims FOR ALL TO authenticated USING (public.is_editor()) WITH CHECK (public.is_editor());
DROP POLICY IF EXISTS claim_resources_editor_all ON public.claim_supporting_resources;
CREATE POLICY claim_resources_editor_all ON public.claim_supporting_resources FOR ALL TO authenticated USING (public.is_editor()) WITH CHECK (public.is_editor());
DROP POLICY IF EXISTS claim_reviews_editor_read ON public.claim_editorial_reviews;
CREATE POLICY claim_reviews_editor_read ON public.claim_editorial_reviews FOR SELECT TO authenticated USING (public.is_editor());
DROP POLICY IF EXISTS claim_reviews_editor_insert ON public.claim_editorial_reviews;
CREATE POLICY claim_reviews_editor_insert ON public.claim_editorial_reviews FOR INSERT TO authenticated WITH CHECK (public.is_editor() AND reviewer = auth.uid());

-- Only the append-only event tables' owner/service role may remove history.
REVOKE UPDATE, DELETE ON public.resource_technical_checks, public.resource_editorial_reviews,
  public.claim_editorial_reviews FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.resource_technical_check_rollup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  failure boolean := NEW.technical_status IN ('temporarily_unavailable','broken','removed','needs_review','unknown');
  prior_failures integer;
  risk text;
  retry_days integer;
BEGIN
  SELECT r.consecutive_failures, t.risk_level INTO prior_failures, risk
  FROM content_resources r JOIN content_topics t ON t.id = r.topic_id
  WHERE r.id = NEW.resource_id FOR UPDATE OF r;
  prior_failures := coalesce(prior_failures, 0);
  retry_days := CASE
    WHEN NEW.technical_status = 'temporarily_unavailable' THEN least(32, (2 ^ least(prior_failures, 5))::integer)
    WHEN NEW.technical_status IN ('broken','removed','needs_review') THEN 7
    WHEN risk = 'high' THEN 7 WHEN risk = 'elevated' THEN 14 ELSE 30 END;
  UPDATE content_resources SET
    normalized_url = NEW.normalized_url,
    final_url = NEW.final_url,
    source_domain = NEW.source_domain,
    response_time_ms = NEW.response_time_ms,
    mime_type = NEW.content_type,
    technical_status = NEW.technical_status,
    embed_status = NEW.embed_status,
    last_checked_at = NEW.checked_at,
    last_embed_check_at = NEW.checked_at,
    last_successful_check_at = CASE WHEN NOT failure THEN NEW.checked_at ELSE last_successful_check_at END,
    last_failed_check_at = CASE WHEN failure THEN NEW.checked_at ELSE last_failed_check_at END,
    consecutive_failures = CASE WHEN failure THEN prior_failures + 1 ELSE 0 END,
    next_check_at = NEW.checked_at + make_interval(days => retry_days),
    needs_review = needs_review OR NEW.technical_status IN ('broken','removed','needs_review')
      OR (NEW.technical_status = 'temporarily_unavailable' AND prior_failures + 1 >= 2),
    needs_review_reason = CASE
      WHEN needs_review_reason IS NOT NULL THEN needs_review_reason
      WHEN NEW.technical_status IN ('broken','removed','needs_review') THEN coalesce(NEW.failure_reason, NEW.technical_status)
      WHEN NEW.technical_status = 'temporarily_unavailable' AND prior_failures + 1 >= 2 THEN 'Repeated temporary link failure'
      ELSE NULL END
  WHERE id = NEW.resource_id;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.resource_technical_check_rollup() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS resource_technical_check_rollup ON public.resource_technical_checks;
CREATE TRIGGER resource_technical_check_rollup AFTER INSERT ON public.resource_technical_checks
  FOR EACH ROW EXECUTE FUNCTION public.resource_technical_check_rollup();

CREATE INDEX IF NOT EXISTS content_topics_editorial_due_idx
  ON public.content_topics(risk_level, next_editorial_review_due_at) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS content_resources_technical_queue_idx
  ON public.content_resources(technical_status, next_check_at) WHERE review_status = 'approved';

COMMENT ON COLUMN public.content_topics.last_editorial_review_at IS
  'Date of a genuine authorized human editorial review. Never written by a link checker.';
COMMENT ON TABLE public.resource_technical_checks IS
  'Append-only technical observations. These rows do not constitute source or claim review.';
COMMENT ON TABLE public.resource_editorial_reviews IS
  'Append-only human source-review decisions, separate from technical link checks.';
COMMENT ON TABLE public.claim_editorial_reviews IS
  'Append-only human claim-review decisions with evidence summaries.';

