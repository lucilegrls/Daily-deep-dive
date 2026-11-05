CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE TABLE public.content_health_baselines (
  metric text PRIMARY KEY CHECK (metric IN ('published_topics','approved_sources','published_categories','active_lanes')),
  baseline integer NOT NULL CHECK (baseline >= 0),
  tolerance numeric NOT NULL DEFAULT 0.10 CHECK (tolerance >= 0 AND tolerance < 1),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.content_health_checks (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  checked_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'scheduled' CHECK (source IN ('scheduled','editor')),
  totals jsonb NOT NULL,
  healthy boolean NOT NULL
);
CREATE TABLE public.content_health_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric text NOT NULL REFERENCES public.content_health_baselines(metric),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  baseline integer NOT NULL,
  threshold integer NOT NULL,
  observed integer NOT NULL,
  lowest_observed integer NOT NULL,
  seen_count integer NOT NULL DEFAULT 1,
  opened_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_observed integer
);
CREATE UNIQUE INDEX content_health_one_open_per_metric ON public.content_health_incidents (metric) WHERE status = 'open';
CREATE INDEX content_health_checks_time ON public.content_health_checks (checked_at DESC);

REVOKE ALL ON public.content_health_baselines, public.content_health_checks, public.content_health_incidents FROM anon, authenticated;
GRANT SELECT ON public.content_health_baselines, public.content_health_checks, public.content_health_incidents TO authenticated;
GRANT ALL ON public.content_health_baselines, public.content_health_checks, public.content_health_incidents TO service_role;
ALTER TABLE public.content_health_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_health_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_health_incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY health_baselines_editor_read ON public.content_health_baselines FOR SELECT TO authenticated USING (public.is_editor());
CREATE POLICY health_checks_editor_read ON public.content_health_checks FOR SELECT TO authenticated USING (public.is_editor());
CREATE POLICY health_incidents_editor_read ON public.content_health_incidents FOR SELECT TO authenticated USING (public.is_editor());

INSERT INTO public.content_health_baselines(metric, baseline, tolerance) VALUES
  ('published_topics', 74, 0.10),
  ('approved_sources', 144, 0.10),
  ('published_categories', (SELECT count(DISTINCT category) FROM public.content_topics WHERE status='published'), 0.10),
  ('active_lanes', 13, 0.0)
ON CONFLICT (metric) DO NOTHING;

-- Writes happen only through this function. It runs with owner rights so the
-- scheduler and editors can record results, but refuses anyone who is not the
-- scheduler (no JWT) or an editor.
CREATE OR REPLACE FUNCTION public.run_content_health_check(_source text DEFAULT 'scheduled')
RETURNS TABLE(metric text, observed integer, threshold integer, healthy boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_totals jsonb;
  v_all_ok boolean := true;
  b record;
  v_obs integer;
  v_thr integer;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_editor() THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  IF auth.uid() IS NULL AND coalesce(auth.role(), '') IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  v_totals := jsonb_build_object(
    'published_topics', (SELECT count(*) FROM content_topics WHERE status='published'),
    'approved_sources', (SELECT count(*) FROM content_resources r JOIN content_topics t ON t.id=r.topic_id WHERE r.review_status='approved' AND t.status='published'),
    'published_categories', (SELECT count(DISTINCT category) FROM content_topics WHERE status='published'),
    'active_lanes', (SELECT count(*) FROM interest_lanes WHERE active)
  );

  FOR b IN SELECT * FROM content_health_baselines ORDER BY content_health_baselines.metric LOOP
    v_obs := (v_totals ->> b.metric)::integer;
    v_thr := ceil(b.baseline * (1 - b.tolerance))::integer;
    IF v_obs < v_thr THEN
      v_all_ok := false;
      INSERT INTO content_health_incidents(metric, baseline, threshold, observed, lowest_observed)
      VALUES (b.metric, b.baseline, v_thr, v_obs, v_obs)
      ON CONFLICT (metric) WHERE status = 'open' DO UPDATE
        SET observed = EXCLUDED.observed,
            lowest_observed = LEAST(content_health_incidents.lowest_observed, EXCLUDED.observed),
            seen_count = content_health_incidents.seen_count + 1,
            last_seen_at = now();
    ELSE
      UPDATE content_health_incidents
         SET status = 'resolved', resolved_at = now(), resolved_observed = v_obs
       WHERE content_health_incidents.metric = b.metric AND status = 'open';
    END IF;
    metric := b.metric; observed := v_obs; threshold := v_thr; healthy := v_obs >= v_thr;
    RETURN NEXT;
  END LOOP;

  INSERT INTO content_health_checks(source, totals, healthy)
  VALUES (CASE WHEN _source = 'editor' THEN 'editor' ELSE 'scheduled' END, v_totals, v_all_ok);
END $$;
REVOKE ALL ON FUNCTION public.run_content_health_check(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.run_content_health_check(text) TO authenticated, service_role;