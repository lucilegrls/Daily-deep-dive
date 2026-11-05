CREATE TABLE IF NOT EXISTS public.resource_agent_reviews (
  resource_id uuid PRIMARY KEY REFERENCES public.content_resources(id) ON DELETE CASCADE,
  verdict text NOT NULL CHECK (verdict IN ('approve','needs_review','reject')),
  confidence integer NOT NULL DEFAULT 0 CHECK (confidence BETWEEN 0 AND 100),
  topic_fit text,
  credibility text,
  summary text,
  suggested_reason text,
  suggested_difficulty text,
  model text NOT NULL,
  applied_action text NOT NULL DEFAULT 'none',
  previous_review_status text,
  evaluated_at timestamptz NOT NULL DEFAULT now(),
  overridden_at timestamptz
);
GRANT SELECT, INSERT, UPDATE ON public.resource_agent_reviews TO authenticated;
GRANT ALL ON public.resource_agent_reviews TO service_role;
ALTER TABLE public.resource_agent_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Editors read agent reviews" ON public.resource_agent_reviews FOR SELECT TO authenticated USING (public.is_editor());
CREATE POLICY "Editors write agent reviews" ON public.resource_agent_reviews FOR INSERT TO authenticated WITH CHECK (public.is_editor());
CREATE POLICY "Editors update agent reviews" ON public.resource_agent_reviews FOR UPDATE TO authenticated USING (public.is_editor()) WITH CHECK (public.is_editor());
CREATE INDEX IF NOT EXISTS resource_agent_reviews_verdict_idx ON public.resource_agent_reviews (verdict, evaluated_at DESC);