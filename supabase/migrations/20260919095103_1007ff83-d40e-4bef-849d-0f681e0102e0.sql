
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
DROP FUNCTION IF EXISTS public.streak_for(UUID);

CREATE OR REPLACE FUNCTION public.my_streak()
RETURNS TABLE (current_streak INTEGER, best_streak INTEGER, total_reads BIGINT)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  d DATE;
  prev DATE;
  cur INTEGER := 0;
  best INTEGER := 0;
  running INTEGER := 0;
  today DATE := (now() AT TIME ZONE 'utc')::date;
  uid UUID := auth.uid();
BEGIN
  FOR d IN
    SELECT DISTINCT read_day AS day
    FROM public.topic_reads
    WHERE user_id = uid
    ORDER BY day DESC
  LOOP
    IF prev IS NULL THEN
      running := 1;
      IF d = today OR d = today - 1 THEN cur := 1; END IF;
    ELSIF prev - d = 1 THEN
      running := running + 1;
      IF cur > 0 AND cur = running - 1 THEN cur := running; END IF;
    ELSE
      running := 1;
    END IF;
    IF running > best THEN best := running; END IF;
    prev := d;
  END LOOP;

  RETURN QUERY
    SELECT cur, best, (SELECT count(*) FROM public.topic_reads WHERE user_id = uid);
END;
$$;

GRANT EXECUTE ON FUNCTION public.my_streak() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.leaderboard(TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leaderboard(TEXT, INTEGER) TO authenticated, anon;
