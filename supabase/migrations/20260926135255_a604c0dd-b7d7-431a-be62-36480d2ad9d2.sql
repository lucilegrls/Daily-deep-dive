CREATE TABLE public.content_topic_translations (
  topic_id integer NOT NULL REFERENCES public.content_topics(id) ON DELETE CASCADE,
  lang text NOT NULL CHECK (lang IN ('fr','es','zh','ar')),
  title text NOT NULL CHECK (length(btrim(title)) > 0),
  context text NOT NULL DEFAULT '',
  takeaways text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  translated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (topic_id, lang)
);
REVOKE ALL ON public.content_topic_translations FROM anon, authenticated;
GRANT SELECT ON public.content_topic_translations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_topic_translations TO authenticated;
GRANT ALL ON public.content_topic_translations TO service_role;
ALTER TABLE public.content_topic_translations ENABLE ROW LEVEL SECURITY;
CREATE POLICY translations_public_read ON public.content_topic_translations FOR SELECT TO anon, authenticated
  USING (status = 'published' AND EXISTS (SELECT 1 FROM public.content_topics t WHERE t.id = topic_id AND t.status = 'published'));
CREATE POLICY translations_editor_read ON public.content_topic_translations FOR SELECT TO authenticated USING (public.is_editor());
CREATE POLICY translations_editor_write ON public.content_topic_translations FOR ALL TO authenticated USING (public.is_editor()) WITH CHECK (public.is_editor());
CREATE TRIGGER content_topic_translations_touch BEFORE UPDATE ON public.content_topic_translations FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.source_link_checks (
  resource_id uuid PRIMARY KEY REFERENCES public.content_resources(id) ON DELETE CASCADE,
  outcome text NOT NULL CHECK (outcome IN ('ok','redirected','broken','blocked','error')),
  status_code integer,
  final_url text,
  detail text,
  checked_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.source_link_checks FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.source_link_checks TO authenticated;
GRANT ALL ON public.source_link_checks TO service_role;
ALTER TABLE public.source_link_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY link_checks_editor_all ON public.source_link_checks FOR ALL TO authenticated USING (public.is_editor()) WITH CHECK (public.is_editor());