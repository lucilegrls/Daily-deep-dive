-- 1. Integrity: bounded user-written text (existing data validated first: notes max 0 chars, names 6 chars)
ALTER TABLE public.topic_notes DROP CONSTRAINT IF EXISTS topic_notes_body_len;
ALTER TABLE public.topic_notes ADD CONSTRAINT topic_notes_body_len CHECK (char_length(body) <= 20000) NOT VALID;
ALTER TABLE public.topic_notes VALIDATE CONSTRAINT topic_notes_body_len;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_display_name_len;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_display_name_len CHECK (char_length(btrim(display_name)) BETWEEN 1 AND 60) NOT VALID;
ALTER TABLE public.profiles VALIDATE CONSTRAINT profiles_display_name_len;
ALTER TABLE public.resource_progress DROP CONSTRAINT IF EXISTS resource_progress_position_size;
ALTER TABLE public.resource_progress ADD CONSTRAINT resource_progress_position_size CHECK (pg_column_size(position) <= 8192) NOT VALID;
ALTER TABLE public.resource_progress VALIDATE CONSTRAINT resource_progress_position_size;

-- Redundant duplicate of topic_reads_user_topic_day_key
DROP INDEX IF EXISTS public.topic_reads_unique_day;
CREATE INDEX IF NOT EXISTS topic_reads_read_at_idx ON public.topic_reads (read_at);
CREATE INDEX IF NOT EXISTS resource_progress_resource_idx ON public.resource_progress (resource_id);
CREATE INDEX IF NOT EXISTS resource_embed_failures_resource_idx ON public.resource_embed_failures (resource_id, report_day);
CREATE INDEX IF NOT EXISTS content_resources_review_idx ON public.content_resources (review_status, topic_id);

-- Reads are append-only for readers (the leaderboard counts them); deletion happens through account deletion.
DROP POLICY IF EXISTS reads_own ON public.topic_reads;
DROP POLICY IF EXISTS reads_select_own ON public.topic_reads;
DROP POLICY IF EXISTS reads_insert_own ON public.topic_reads;
CREATE POLICY reads_select_own ON public.topic_reads FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY reads_insert_own ON public.topic_reads FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
REVOKE UPDATE, DELETE ON public.topic_reads FROM authenticated, anon;

-- Readers may only reference published topics / approved resources in their own records.
DROP POLICY IF EXISTS saved_own ON public.saved_topics;
CREATE POLICY saved_own ON public.saved_topics FOR ALL TO authenticated USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.content_topics t WHERE t.id = topic_id AND (t.status = 'published' OR public.is_editor())));
DROP POLICY IF EXISTS progress_own ON public.resource_progress;
CREATE POLICY progress_own ON public.resource_progress FOR ALL TO authenticated USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.content_resources r WHERE r.id = resource_id AND (r.review_status = 'approved' OR public.is_editor())));
DROP POLICY IF EXISTS embed_failures_insert_own ON public.resource_embed_failures;
CREATE POLICY embed_failures_insert_own ON public.resource_embed_failures FOR INSERT TO authenticated
  WITH CHECK (reporter = auth.uid() AND EXISTS (SELECT 1 FROM public.content_resources r WHERE r.id = resource_id AND r.review_status = 'approved'));

-- 2. Source health: independent dimensions, never collapsed into one "verified" flag.
ALTER TABLE public.content_resources
  ADD COLUMN IF NOT EXISTS link_status text NOT NULL DEFAULT 'unchecked',
  ADD COLUMN IF NOT EXISTS access_level text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS topic_fit_status text NOT NULL DEFAULT 'unreviewed',
  ADD COLUMN IF NOT EXISTS credibility_status text NOT NULL DEFAULT 'unreviewed',
  ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS needs_review_reason text,
  ADD COLUMN IF NOT EXISTS consecutive_failures integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_check_at timestamptz;
DO $$ BEGIN
  ALTER TABLE public.content_resources ADD CONSTRAINT content_resources_health_values CHECK (
    link_status IN ('unchecked','ok','redirected','broken','blocked','timeout','error','removed')
    AND access_level IN ('unknown','full','abstract','preview','paywall','login')
    AND topic_fit_status IN ('unreviewed','matches','partial','mismatch')
    AND credibility_status IN ('unreviewed','credible','questionable','rejected')
    AND consecutive_failures >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.source_link_checks
  ADD COLUMN IF NOT EXISTS requested_url text,
  ADD COLUMN IF NOT EXISTS redirect_chain jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS access_level text,
  ADD COLUMN IF NOT EXISTS embed_allowed boolean,
  ADD COLUMN IF NOT EXISTS failure_reason text;

-- Reader reports of a broken embed flag the source for review (never change approval).
CREATE OR REPLACE FUNCTION public.embed_failure_flag()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF (SELECT count(DISTINCT reporter) FROM resource_embed_failures
      WHERE resource_id = NEW.resource_id AND report_day > current_date - 14) >= 2 THEN
    UPDATE content_resources SET needs_review = true,
      needs_review_reason = coalesce(needs_review_reason, 'Readers reported the source did not display')
    WHERE id = NEW.resource_id AND NOT needs_review;
  END IF;
  RETURN NULL;
END $$;
REVOKE EXECUTE ON FUNCTION public.embed_failure_flag() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS embed_failure_flag ON public.resource_embed_failures;
CREATE TRIGGER embed_failure_flag AFTER INSERT ON public.resource_embed_failures
  FOR EACH ROW EXECUTE FUNCTION public.embed_failure_flag();

-- 11. Honest pipeline stage, separate from publication status. Existing rows are left as they are.
ALTER TABLE public.content_topics ADD COLUMN IF NOT EXISTS verification_stage text;
DO $$ BEGIN
  ALTER TABLE public.content_topics ADD CONSTRAINT content_topics_verification_stage CHECK (
    verification_stage IS NULL OR verification_stage IN ('candidate','researched','source_checked','editorially_approved','published','needs_reverification'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE public.content_topics ADD COLUMN IF NOT EXISTS last_verified_at timestamptz;
COMMENT ON COLUMN public.content_topics.verification_stage IS 'Editorial verification stage; NULL = not yet assessed. Independent of status (publication).';

-- 12. AI proposals may never be approved/published without an editor.
CREATE OR REPLACE FUNCTION public.ai_origin_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.origin ILIKE 'ai%' AND auth.uid() IS NULL
     AND ((TG_TABLE_NAME = 'content_topics' AND NEW.status = 'published')
       OR (TG_TABLE_NAME = 'content_resources' AND NEW.review_status = 'approved')) THEN
    RAISE EXCEPTION 'AI-originated content needs an editor to approve or publish it';
  END IF;
  IF NEW.origin ILIKE 'ai%' AND auth.uid() IS NOT NULL AND NOT public.is_editor()
     AND ((TG_TABLE_NAME = 'content_topics' AND NEW.status = 'published')
       OR (TG_TABLE_NAME = 'content_resources' AND NEW.review_status = 'approved')) THEN
    RAISE EXCEPTION 'Only editors may approve AI-originated content';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS ai_origin_guard ON public.content_topics;
CREATE TRIGGER ai_origin_guard BEFORE INSERT OR UPDATE OF status ON public.content_topics FOR EACH ROW EXECUTE FUNCTION public.ai_origin_guard();
DROP TRIGGER IF EXISTS ai_origin_guard ON public.content_resources;
CREATE TRIGGER ai_origin_guard BEFORE INSERT OR UPDATE OF review_status ON public.content_resources FOR EACH ROW EXECUTE FUNCTION public.ai_origin_guard();