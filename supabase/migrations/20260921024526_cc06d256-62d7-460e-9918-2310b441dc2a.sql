DO $$
DECLARE n bigint;
BEGIN
  SELECT (SELECT count(*) FROM public.saved_topics s LEFT JOIN public.content_topics t ON t.id=s.topic_id WHERE t.id IS NULL)
       + (SELECT count(*) FROM public.topic_notes s LEFT JOIN public.content_topics t ON t.id=s.topic_id WHERE t.id IS NULL)
       + (SELECT count(*) FROM public.topic_reads s LEFT JOIN public.content_topics t ON t.id=s.topic_id WHERE t.id IS NULL)
  INTO n;
  IF n > 0 THEN
    RAISE EXCEPTION 'Aborting: % orphan topic_id rows found', n;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'saved_topics_topic_id_fkey' AND conrelid = 'public.saved_topics'::regclass) THEN
    ALTER TABLE public.saved_topics ADD CONSTRAINT saved_topics_topic_id_fkey FOREIGN KEY (topic_id) REFERENCES public.content_topics(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'topic_notes_topic_id_fkey' AND conrelid = 'public.topic_notes'::regclass) THEN
    ALTER TABLE public.topic_notes ADD CONSTRAINT topic_notes_topic_id_fkey FOREIGN KEY (topic_id) REFERENCES public.content_topics(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'topic_reads_topic_id_fkey' AND conrelid = 'public.topic_reads'::regclass) THEN
    ALTER TABLE public.topic_reads ADD CONSTRAINT topic_reads_topic_id_fkey FOREIGN KEY (topic_id) REFERENCES public.content_topics(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS saved_topics_topic_id_idx ON public.saved_topics(topic_id);
CREATE INDEX IF NOT EXISTS topic_notes_topic_id_idx ON public.topic_notes(topic_id);
CREATE INDEX IF NOT EXISTS topic_reads_topic_id_idx ON public.topic_reads(topic_id);

DROP POLICY IF EXISTS profiles_select_authenticated ON public.profiles;
CREATE POLICY profiles_select_authenticated ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

REVOKE ALL ON public.content_topics, public.content_resources, public.content_topic_private,
  public.content_resource_private, public.editorial_runs, public.topic_backlog,
  public.interest_lanes, public.interest_lane_categories, public.profiles,
  public.saved_topics, public.topic_notes, public.topic_reads,
  public.user_interests, public.user_roles
  FROM anon, authenticated;

GRANT SELECT ON public.content_topics, public.content_resources, public.interest_lanes, public.interest_lane_categories TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.content_topics, public.content_resources, public.content_topic_private,
  public.content_resource_private, public.editorial_runs, public.topic_backlog,
  public.interest_lanes, public.interest_lane_categories,
  public.saved_topics, public.topic_notes, public.topic_reads, public.user_interests
  TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.user_roles TO authenticated;

REVOKE ALL ON SEQUENCE public.topic_reads_id_seq FROM anon, authenticated;
GRANT USAGE ON SEQUENCE public.topic_reads_id_seq TO authenticated;

REVOKE EXECUTE ON FUNCTION public.apply_onboarding(text[], text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_onboarding(text[], text, text, boolean) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.my_streak() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_streak() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.expand_interests(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expand_interests(text[]) TO anon, authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_safe_source_url(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_safe_source_url(text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_editor() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_editor() TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.feed_topics(text, text, text[], integer[], integer, integer, integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.feed_topics(text, text, text[], integer[], integer, integer, integer, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.search_topics(text, text, integer, integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.leaderboard(text, integer) TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;