CREATE INDEX IF NOT EXISTS resource_embed_failures_reporter_day_idx ON public.resource_embed_failures (reporter, report_day);
CREATE INDEX IF NOT EXISTS topic_reads_user_day_idx ON public.topic_reads (user_id, read_day);
CREATE INDEX IF NOT EXISTS saved_topics_user_created_idx ON public.saved_topics (user_id, created_at);

-- Per-account daily caps. Far above normal reading; stop runaway loops/scripts.
CREATE OR REPLACE FUNCTION public.embed_failure_rate_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF (SELECT count(*) FROM public.resource_embed_failures
      WHERE reporter = NEW.reporter AND report_day = (now() AT TIME ZONE 'utc')::date) >= 20 THEN
    RAISE EXCEPTION 'rate_limited' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS embed_failure_rate_guard ON public.resource_embed_failures;
CREATE TRIGGER embed_failure_rate_guard BEFORE INSERT ON public.resource_embed_failures
  FOR EACH ROW EXECUTE FUNCTION public.embed_failure_rate_guard();

CREATE OR REPLACE FUNCTION public.topic_reads_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.read_at := now();
  NEW.read_day := (now() AT TIME ZONE 'utc')::date;
  NEW.seconds := LEAST(GREATEST(COALESCE(NEW.seconds, 0), 0), 3600);
  IF (SELECT count(*) FROM public.topic_reads
      WHERE user_id = NEW.user_id AND read_day = NEW.read_day) >= 300 THEN
    RAISE EXCEPTION 'rate_limited' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.saved_topics_rate_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF (SELECT count(*) FROM public.saved_topics
      WHERE user_id = NEW.user_id AND created_at > now() - interval '24 hours') >= 300 THEN
    RAISE EXCEPTION 'rate_limited' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS saved_topics_rate_guard ON public.saved_topics;
CREATE TRIGGER saved_topics_rate_guard BEFORE INSERT ON public.saved_topics
  FOR EACH ROW EXECUTE FUNCTION public.saved_topics_rate_guard();