CREATE TABLE IF NOT EXISTS public.topic_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  details text,
  lane_slug text REFERENCES public.interest_lanes(slug) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'new',
  editor_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT topic_suggestions_status_check
    CHECK (status IN ('new','reviewed','planned','declined','published')),
  CONSTRAINT topic_suggestions_title_length_check
    CHECK (char_length(btrim(title)) BETWEEN 8 AND 160),
  CONSTRAINT topic_suggestions_details_length_check
    CHECK (details IS NULL OR char_length(details) <= 1200)
);

CREATE INDEX IF NOT EXISTS topic_suggestions_user_created_idx
  ON public.topic_suggestions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS topic_suggestions_status_created_idx
  ON public.topic_suggestions (status, created_at);

REVOKE ALL ON public.topic_suggestions FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.topic_suggestions TO authenticated;
GRANT ALL ON public.topic_suggestions TO service_role;

ALTER TABLE public.topic_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS suggestions_insert_own ON public.topic_suggestions;
CREATE POLICY suggestions_insert_own ON public.topic_suggestions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'new' AND editor_note IS NULL);

DROP POLICY IF EXISTS suggestions_select_own ON public.topic_suggestions;
CREATE POLICY suggestions_select_own ON public.topic_suggestions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS suggestions_editor_read ON public.topic_suggestions;
CREATE POLICY suggestions_editor_read ON public.topic_suggestions
  FOR SELECT TO authenticated
  USING (public.is_editor());

DROP POLICY IF EXISTS suggestions_editor_update ON public.topic_suggestions;
CREATE POLICY suggestions_editor_update ON public.topic_suggestions
  FOR UPDATE TO authenticated
  USING (public.is_editor())
  WITH CHECK (public.is_editor());

DROP TRIGGER IF EXISTS topic_suggestions_touch_updated_at ON public.topic_suggestions;
CREATE TRIGGER topic_suggestions_touch_updated_at
  BEFORE UPDATE ON public.topic_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();