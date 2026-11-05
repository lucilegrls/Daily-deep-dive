
ALTER TABLE public.content_resources DROP CONSTRAINT IF EXISTS content_resources_kind_check;
ALTER TABLE public.content_resources ADD CONSTRAINT content_resources_kind_check
  CHECK (kind = ANY (ARRAY['books','papers','videos','articles','pdfs','podcasts','tools']));

ALTER TABLE public.content_resources
  ADD COLUMN IF NOT EXISTS embed_type text NOT NULL DEFAULT 'link_only',
  ADD COLUMN IF NOT EXISTS embedding_status text NOT NULL DEFAULT 'needs_review',
  ADD COLUMN IF NOT EXISTS rights_status text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS is_start_here boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS embed_url text,
  ADD COLUMN IF NOT EXISTS thumbnail_url text,
  ADD COLUMN IF NOT EXISTS content_url text,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_checked_at timestamptz;

DO $$ BEGIN
  ALTER TABLE public.content_resources ADD CONSTRAINT content_resources_embed_type_check
    CHECK (embed_type IN ('video','internal_reader','embedded_external','pdf','audio','link_only'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.content_resources ADD CONSTRAINT content_resources_rights_check
    CHECK (rights_status IN ('owned','licensed','public_domain','embed_only','link_only','unknown'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.content_resources ADD CONSTRAINT content_resources_embedding_status_check
    CHECK (embedding_status IN ('approved','blocked','needs_review','broken'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.content_resources ADD CONSTRAINT content_resources_aux_urls_safe
    CHECK ((embed_url IS NULL OR embed_url ~* '^https://') AND (thumbnail_url IS NULL OR thumbnail_url ~* '^https://') AND (content_url IS NULL OR content_url ~* '^https://'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS content_resources_one_start_here
  ON public.content_resources (topic_id) WHERE is_start_here;

CREATE OR REPLACE FUNCTION public.content_resources_viewer_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE host text;
BEGIN
  IF NEW.embed_url IS NOT NULL THEN
    host := lower(substring(NEW.embed_url from '^https://([^/:?#]+)'));
    IF host IS NULL OR host NOT IN ('www.youtube-nocookie.com','www.youtube.com','youtube.com','player.vimeo.com') AND NEW.embed_type IN ('video','audio') THEN
      RAISE EXCEPTION 'Video embeds must use the official YouTube or Vimeo player';
    END IF;
  END IF;
  IF NEW.review_status = 'approved' THEN
    IF NEW.embed_type IN ('internal_reader','pdf') AND NEW.rights_status NOT IN ('owned','licensed','public_domain') THEN
      RAISE EXCEPTION 'In-app text or PDF needs rights owned, licensed or public domain';
    END IF;
    IF NEW.embed_type = 'embedded_external' AND NEW.embedding_status <> 'approved' THEN
      RAISE EXCEPTION 'An embedded page must be checked before approval';
    END IF;
    IF NEW.published_at IS NULL THEN NEW.published_at := now(); END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS content_resources_viewer_guard ON public.content_resources;
CREATE TRIGGER content_resources_viewer_guard BEFORE INSERT OR UPDATE ON public.content_resources
  FOR EACH ROW EXECUTE FUNCTION public.content_resources_viewer_guard();

ALTER TABLE public.content_resource_private ADD COLUMN IF NOT EXISTS rights_notes text;

-- Full in-app text, rights-gated
CREATE TABLE IF NOT EXISTS public.content_resource_bodies (
  resource_id uuid PRIMARY KEY REFERENCES public.content_resources(id) ON DELETE CASCADE,
  content_html text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.content_resource_bodies TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_resource_bodies TO authenticated;
GRANT ALL ON public.content_resource_bodies TO service_role;
ALTER TABLE public.content_resource_bodies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bodies_public_read ON public.content_resource_bodies;
CREATE POLICY bodies_public_read ON public.content_resource_bodies FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.content_resources r JOIN public.content_topics t ON t.id = r.topic_id
    WHERE r.id = resource_id AND r.review_status = 'approved' AND t.status = 'published'
      AND r.rights_status IN ('owned','licensed','public_domain')));
DROP POLICY IF EXISTS bodies_editor_all ON public.content_resource_bodies;
CREATE POLICY bodies_editor_all ON public.content_resource_bodies FOR ALL TO authenticated
  USING (public.is_editor()) WITH CHECK (public.is_editor());
DROP TRIGGER IF EXISTS bodies_touch ON public.content_resource_bodies;
CREATE TRIGGER bodies_touch BEFORE UPDATE ON public.content_resource_bodies FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Link history
CREATE TABLE IF NOT EXISTS public.content_resource_url_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  resource_id uuid NOT NULL REFERENCES public.content_resources(id) ON DELETE CASCADE,
  old_url text NOT NULL,
  new_url text NOT NULL,
  changed_by uuid DEFAULT auth.uid(),
  changed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.content_resource_url_history TO authenticated;
GRANT ALL ON public.content_resource_url_history TO service_role;
ALTER TABLE public.content_resource_url_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS url_history_editor_read ON public.content_resource_url_history;
CREATE POLICY url_history_editor_read ON public.content_resource_url_history FOR SELECT TO authenticated USING (public.is_editor());

CREATE OR REPLACE FUNCTION public.content_resources_url_history()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.url IS DISTINCT FROM OLD.url THEN
    INSERT INTO public.content_resource_url_history(resource_id, old_url, new_url) VALUES (OLD.id, OLD.url, NEW.url);
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.content_resources_url_history() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS content_resources_url_history ON public.content_resources;
CREATE TRIGGER content_resources_url_history AFTER UPDATE OF url ON public.content_resources
  FOR EACH ROW EXECUTE FUNCTION public.content_resources_url_history();

-- Embed failure reports
CREATE TABLE IF NOT EXISTS public.resource_embed_failures (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  resource_id uuid NOT NULL REFERENCES public.content_resources(id) ON DELETE CASCADE,
  reporter uuid NOT NULL DEFAULT auth.uid(),
  reason text NOT NULL CHECK (char_length(reason) <= 200),
  report_day date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (resource_id, reporter, report_day)
);
GRANT SELECT, INSERT ON public.resource_embed_failures TO authenticated;
GRANT ALL ON public.resource_embed_failures TO service_role;
ALTER TABLE public.resource_embed_failures ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS embed_failures_insert_own ON public.resource_embed_failures;
CREATE POLICY embed_failures_insert_own ON public.resource_embed_failures FOR INSERT TO authenticated WITH CHECK (reporter = auth.uid());
DROP POLICY IF EXISTS embed_failures_editor_read ON public.resource_embed_failures;
CREATE POLICY embed_failures_editor_read ON public.resource_embed_failures FOR SELECT TO authenticated USING (public.is_editor());

-- Reading progress
CREATE TABLE IF NOT EXISTS public.resource_progress (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resource_id uuid NOT NULL REFERENCES public.content_resources(id) ON DELETE CASCADE,
  completed_at timestamptz,
  position jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, resource_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.resource_progress TO authenticated;
GRANT ALL ON public.resource_progress TO service_role;
ALTER TABLE public.resource_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS progress_own ON public.resource_progress;
CREATE POLICY progress_own ON public.resource_progress FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS progress_touch ON public.resource_progress;
CREATE TRIGGER progress_touch BEFORE UPDATE ON public.resource_progress FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Glossary
CREATE TABLE IF NOT EXISTS public.concept_glossary (
  term text PRIMARY KEY CHECK (term = lower(trim(term)) AND char_length(term) BETWEEN 1 AND 80),
  definition text NOT NULL,
  simple_explanation text,
  why_it_matters text,
  topic_ids integer[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.concept_glossary TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.concept_glossary TO authenticated;
GRANT ALL ON public.concept_glossary TO service_role;
ALTER TABLE public.concept_glossary ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS glossary_public_read ON public.concept_glossary;
CREATE POLICY glossary_public_read ON public.concept_glossary FOR SELECT TO anon, authenticated USING (status = 'published');
DROP POLICY IF EXISTS glossary_editor_all ON public.concept_glossary;
CREATE POLICY glossary_editor_all ON public.concept_glossary FOR ALL TO authenticated USING (public.is_editor()) WITH CHECK (public.is_editor());
DROP TRIGGER IF EXISTS glossary_touch ON public.concept_glossary;
CREATE TRIGGER glossary_touch BEFORE UPDATE ON public.concept_glossary FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
