CREATE TABLE public.content_topic_source_codes (
  source_code text PRIMARY KEY,
  source_group text NOT NULL,
  source_title text NOT NULL,
  topic_id integer NOT NULL REFERENCES public.content_topics(id) ON DELETE CASCADE,
  match_kind text NOT NULL CHECK (match_kind IN ('created','existing','merged')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX content_topic_source_codes_topic_idx ON public.content_topic_source_codes(topic_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_topic_source_codes TO authenticated;
GRANT ALL ON public.content_topic_source_codes TO service_role;
ALTER TABLE public.content_topic_source_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Editors manage source codes" ON public.content_topic_source_codes
  FOR ALL TO authenticated USING (public.is_editor()) WITH CHECK (public.is_editor());