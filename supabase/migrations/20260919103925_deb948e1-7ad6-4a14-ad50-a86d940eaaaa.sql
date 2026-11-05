CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============ roles ============
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('owner','editor','reader');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roles_select_own" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_editor()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('owner','editor')
  )
$$;
REVOKE EXECUTE ON FUNCTION public.is_editor() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_editor() TO authenticated, service_role;

-- ============ url safety ============
CREATE OR REPLACE FUNCTION public.is_safe_source_url(_url text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE host text;
BEGIN
  IF _url IS NULL OR _url !~* '^https?://[^\s/]+' THEN RETURN false; END IF;
  host := lower(split_part(split_part(regexp_replace(_url, '^https?://', ''), '/', 1), ':', 1));
  host := regexp_replace(host, '^.*@', '');
  IF host = 'wikipedia.org' OR host LIKE '%.wikipedia.org'
     OR host = 'wikimedia.org' OR host LIKE '%.wikimedia.org'
     OR host = 'wikiwand.com' OR host LIKE '%.wikiwand.com' THEN
    RETURN false;
  END IF;
  RETURN true;
END;
$$;

-- ============ topics ============
CREATE TABLE IF NOT EXISTS public.content_topics (
  id integer PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  category text NOT NULL,
  context text NOT NULL DEFAULT '',
  takeaways text[] NOT NULL DEFAULT '{}',
  tags text[] NOT NULL DEFAULT '{}',
  related_ids integer[] NOT NULL DEFAULT '{}',
  difficulty text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','in_review','published','rejected')),
  origin text NOT NULL DEFAULT 'manual',
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  editorial_notes text,
  last_verified date,
  published_at timestamptz,
  search_text text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS content_topics_status_idx ON public.content_topics (status, id);
CREATE INDEX IF NOT EXISTS content_topics_category_idx ON public.content_topics (category);
CREATE INDEX IF NOT EXISTS content_topics_search_idx ON public.content_topics USING gin (search_text gin_trgm_ops);

GRANT SELECT ON public.content_topics TO anon;
GRANT SELECT ON public.content_topics TO authenticated;
GRANT ALL ON public.content_topics TO service_role;
ALTER TABLE public.content_topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "topics_public_read_published" ON public.content_topics
  FOR SELECT TO anon, authenticated USING (status = 'published');
CREATE POLICY "topics_editor_read_all" ON public.content_topics
  FOR SELECT TO authenticated USING (public.is_editor());
CREATE POLICY "topics_editor_write" ON public.content_topics
  FOR ALL TO authenticated USING (public.is_editor()) WITH CHECK (public.is_editor());

-- ============ resources ============
CREATE TABLE IF NOT EXISTS public.content_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id integer NOT NULL REFERENCES public.content_topics(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('books','papers','videos','articles')),
  title text NOT NULL,
  url text NOT NULL CHECK (public.is_safe_source_url(url)),
  author text,
  source text,
  publication text,
  creator text,
  duration text,
  difficulty text,
  format text,
  description text,
  concepts text[] NOT NULL DEFAULT '{}',
  credibility_notes text,
  selection_reason text,
  review_status text NOT NULL DEFAULT 'candidate' CHECK (review_status IN ('candidate','approved','rejected')),
  rejection_reason text,
  verification jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_checked date,
  position integer NOT NULL DEFAULT 0,
  origin text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (topic_id, url)
);
CREATE INDEX IF NOT EXISTS content_resources_topic_idx ON public.content_resources (topic_id, kind, position);

GRANT SELECT ON public.content_resources TO anon;
GRANT SELECT ON public.content_resources TO authenticated;
GRANT ALL ON public.content_resources TO service_role;
ALTER TABLE public.content_resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "resources_public_read_approved" ON public.content_resources
  FOR SELECT TO anon, authenticated USING (
    review_status = 'approved'
    AND EXISTS (SELECT 1 FROM public.content_topics t WHERE t.id = topic_id AND t.status = 'published')
  );
CREATE POLICY "resources_editor_read_all" ON public.content_resources
  FOR SELECT TO authenticated USING (public.is_editor());
CREATE POLICY "resources_editor_write" ON public.content_resources
  FOR ALL TO authenticated USING (public.is_editor()) WITH CHECK (public.is_editor());

-- ============ cloud saves ============
CREATE TABLE IF NOT EXISTS public.saved_topics (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, topic_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_topics TO authenticated;
GRANT ALL ON public.saved_topics TO service_role;
ALTER TABLE public.saved_topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "saved_own" ON public.saved_topics FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ private notes ============
CREATE TABLE IF NOT EXISTS public.topic_notes (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id integer NOT NULL,
  body text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, topic_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.topic_notes TO authenticated;
GRANT ALL ON public.topic_notes TO service_role;
ALTER TABLE public.topic_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notes_own" ON public.topic_notes FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ editorial runs ============
CREATE TABLE IF NOT EXISTS public.editorial_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'daily_expansion',
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','succeeded','partial','failed')),
  target_count integer NOT NULL DEFAULT 0,
  found_count integer NOT NULL DEFAULT 0,
  imported_count integer NOT NULL DEFAULT 0,
  duplicate_count integer NOT NULL DEFAULT 0,
  rejected_count integer NOT NULL DEFAULT 0,
  shortfall_reason text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
GRANT SELECT ON public.editorial_runs TO authenticated;
GRANT ALL ON public.editorial_runs TO service_role;
ALTER TABLE public.editorial_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "runs_editor_read" ON public.editorial_runs FOR SELECT TO authenticated USING (public.is_editor());
CREATE POLICY "runs_editor_write" ON public.editorial_runs FOR ALL TO authenticated
  USING (public.is_editor()) WITH CHECK (public.is_editor());

-- ============ backlog from the editorial topic map ============
CREATE TABLE IF NOT EXISTS public.topic_backlog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family text NOT NULL,
  idea text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','published','dropped')),
  source text NOT NULL DEFAULT 'EDITORIAL_TOPIC_MAP.md',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (family, idea)
);
GRANT SELECT ON public.topic_backlog TO authenticated;
GRANT ALL ON public.topic_backlog TO service_role;
ALTER TABLE public.topic_backlog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "backlog_editor_read" ON public.topic_backlog FOR SELECT TO authenticated USING (public.is_editor());
CREATE POLICY "backlog_editor_write" ON public.topic_backlog FOR ALL TO authenticated
  USING (public.is_editor()) WITH CHECK (public.is_editor());

-- ============ triggers ============
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.content_topics_search_sync()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.search_text := lower(
    coalesce(NEW.title,'') || ' ' || coalesce(NEW.category,'') || ' ' || coalesce(NEW.context,'') || ' ' ||
    array_to_string(coalesce(NEW.takeaways,'{}'), ' ') || ' ' || array_to_string(coalesce(NEW.tags,'{}'), ' ')
  );
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS content_topics_search ON public.content_topics;
CREATE TRIGGER content_topics_search BEFORE INSERT OR UPDATE ON public.content_topics
  FOR EACH ROW EXECUTE FUNCTION public.content_topics_search_sync();

DROP TRIGGER IF EXISTS content_topics_touch ON public.content_topics;
CREATE TRIGGER content_topics_touch BEFORE UPDATE ON public.content_topics
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS content_resources_touch ON public.content_resources;
CREATE TRIGGER content_resources_touch BEFORE UPDATE ON public.content_resources
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS topic_notes_touch ON public.topic_notes;
CREATE TRIGGER topic_notes_touch BEFORE UPDATE ON public.topic_notes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ public paginated search ============
CREATE OR REPLACE FUNCTION public.search_topics(
  _query text DEFAULT '', _category text DEFAULT NULL,
  _limit integer DEFAULT 12, _offset integer DEFAULT 0
)
RETURNS TABLE (
  id integer, slug text, title text, category text, context text,
  takeaways text[], tags text[], last_verified date, total_count bigint
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH base AS (
    SELECT * FROM public.content_topics t
    WHERE t.status = 'published'
      AND (_category IS NULL OR t.category = _category)
      AND (coalesce(trim(_query), '') = '' OR t.search_text LIKE '%' || lower(trim(_query)) || '%')
  )
  SELECT b.id, b.slug, b.title, b.category, b.context, b.takeaways, b.tags, b.last_verified,
         (SELECT count(*) FROM base) AS total_count
  FROM base b
  ORDER BY b.id
  LIMIT least(coalesce(_limit, 12), 60) OFFSET greatest(coalesce(_offset, 0), 0);
$$;
GRANT EXECUTE ON FUNCTION public.search_topics(text, text, integer, integer) TO anon, authenticated, service_role;