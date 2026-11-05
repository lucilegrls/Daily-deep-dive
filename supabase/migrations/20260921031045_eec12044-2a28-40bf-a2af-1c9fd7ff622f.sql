CREATE TABLE IF NOT EXISTS public.topic_suggestion_private (
  suggestion_id uuid PRIMARY KEY REFERENCES public.topic_suggestions(id) ON DELETE CASCADE,
  editor_note text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.topic_suggestion_private (suggestion_id, editor_note)
SELECT id, editor_note FROM public.topic_suggestions WHERE editor_note IS NOT NULL
ON CONFLICT (suggestion_id) DO NOTHING;

DROP POLICY IF EXISTS suggestions_insert_own ON public.topic_suggestions;

ALTER TABLE public.topic_suggestions DROP COLUMN IF EXISTS editor_note;

CREATE POLICY suggestions_insert_own ON public.topic_suggestions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'new');

REVOKE ALL ON public.topic_suggestion_private FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.topic_suggestion_private TO authenticated;
GRANT ALL ON public.topic_suggestion_private TO service_role;

ALTER TABLE public.topic_suggestion_private ENABLE ROW LEVEL SECURITY;

CREATE POLICY suggestion_private_editor_select ON public.topic_suggestion_private
  FOR SELECT TO authenticated USING (public.is_editor());
CREATE POLICY suggestion_private_editor_insert ON public.topic_suggestion_private
  FOR INSERT TO authenticated WITH CHECK (public.is_editor());
CREATE POLICY suggestion_private_editor_update ON public.topic_suggestion_private
  FOR UPDATE TO authenticated USING (public.is_editor()) WITH CHECK (public.is_editor());

DROP TRIGGER IF EXISTS topic_suggestion_private_touch ON public.topic_suggestion_private;
CREATE TRIGGER topic_suggestion_private_touch
  BEFORE UPDATE ON public.topic_suggestion_private
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();