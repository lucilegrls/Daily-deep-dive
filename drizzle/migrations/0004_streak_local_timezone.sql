CREATE OR REPLACE FUNCTION public.my_streak(_tz text)
 RETURNS TABLE(current_streak integer, best_streak integer, total_reads bigint)
 LANGUAGE plpgsql STABLE SET search_path TO 'public'
AS $function$
DECLARE
  d DATE; prev DATE; cur INTEGER := 0; best INTEGER := 0; running INTEGER := 0;
  tz text := CASE WHEN EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = _tz) THEN _tz ELSE 'UTC' END;
  today DATE := (now() AT TIME ZONE tz)::date;
  uid UUID := auth.uid();
  counting boolean := true;
BEGIN
  FOR d IN
    SELECT DISTINCT (read_at AT TIME ZONE tz)::date AS day
    FROM public.topic_reads WHERE user_id = uid ORDER BY day DESC
  LOOP
    IF prev IS NULL THEN
      running := 1;
      IF d = today OR d = today - 1 THEN cur := 1; ELSE counting := false; END IF;
    ELSIF prev - d = 1 THEN
      running := running + 1;
      IF counting THEN cur := running; END IF;
    ELSE
      running := 1; counting := false;
    END IF;
    IF running > best THEN best := running; END IF;
    prev := d;
  END LOOP;
  RETURN QUERY SELECT cur, best, (SELECT count(*) FROM public.topic_reads WHERE user_id = uid);
END;
$function$;
REVOKE ALL ON FUNCTION public.my_streak(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_streak(text) TO authenticated;