CREATE OR REPLACE FUNCTION public.embed_failure_rate_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.report_day := (now() AT TIME ZONE 'utc')::date;
  NEW.created_at := now();
  IF (SELECT count(*) FROM public.resource_embed_failures
      WHERE reporter = NEW.reporter AND report_day = NEW.report_day) >= 20 THEN
    RAISE EXCEPTION 'rate_limited' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.saved_topics_rate_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.created_at := now();
  IF (SELECT count(*) FROM public.saved_topics
      WHERE user_id = NEW.user_id AND created_at > now() - interval '24 hours') >= 300 THEN
    RAISE EXCEPTION 'rate_limited' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;