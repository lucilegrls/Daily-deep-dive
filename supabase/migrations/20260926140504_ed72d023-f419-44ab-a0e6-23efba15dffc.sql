-- Reads: one per reader/topic/day, server-stamped time.
CREATE UNIQUE INDEX IF NOT EXISTS topic_reads_user_topic_day_key ON public.topic_reads (user_id, topic_id, read_day);

CREATE OR REPLACE FUNCTION public.topic_reads_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.read_at := now();
  NEW.read_day := (now() AT TIME ZONE 'utc')::date;
  NEW.seconds := LEAST(GREATEST(COALESCE(NEW.seconds, 0), 0), 3600);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS topic_reads_guard ON public.topic_reads;
CREATE TRIGGER topic_reads_guard BEFORE INSERT OR UPDATE ON public.topic_reads
  FOR EACH ROW EXECUTE FUNCTION public.topic_reads_guard();

-- Leaderboard: no raw user ids; bounded limit.
DROP FUNCTION IF EXISTS public.leaderboard(text, integer);
CREATE FUNCTION public.leaderboard(_period text DEFAULT 'week', _limit integer DEFAULT 50)
RETURNS TABLE(display_name text, reads bigint, place bigint, is_me boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.display_name, count(*) AS reads,
         rank() OVER (ORDER BY count(*) DESC) AS place,
         (r.user_id = auth.uid()) AS is_me
  FROM public.topic_reads r
  JOIN public.profiles p ON p.id = r.user_id
  WHERE _period <> 'week' OR r.read_at >= date_trunc('week', now())
  GROUP BY r.user_id, p.display_name
  ORDER BY reads DESC, p.display_name
  LIMIT LEAST(GREATEST(COALESCE(_limit, 50), 1), 100);
$$;
REVOKE ALL ON FUNCTION public.leaderboard(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leaderboard(text, integer) TO anon, authenticated, service_role;

-- Suggestions anti-abuse.
CREATE OR REPLACE FUNCTION public.topic_suggestions_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (SELECT count(*) FROM public.topic_suggestions
      WHERE user_id = NEW.user_id AND created_at > now() - interval '24 hours') >= 10 THEN
    RAISE EXCEPTION 'suggestion_rate_limit' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.topic_suggestions
      WHERE user_id = NEW.user_id AND status = 'new' AND lower(btrim(title)) = lower(btrim(NEW.title))) THEN
    RAISE EXCEPTION 'suggestion_duplicate' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.topic_suggestions_guard() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS topic_suggestions_guard ON public.topic_suggestions;
CREATE TRIGGER topic_suggestions_guard BEFORE INSERT ON public.topic_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.topic_suggestions_guard();