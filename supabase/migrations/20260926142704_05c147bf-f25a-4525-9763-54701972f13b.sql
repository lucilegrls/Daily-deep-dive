-- 1. Leaderboard snapshot (no user ids)
CREATE TABLE public.leaderboard_snapshot (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  period text NOT NULL CHECK (period IN ('week','all')),
  place integer NOT NULL,
  display_name text NOT NULL,
  reads integer NOT NULL,
  refreshed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX leaderboard_snapshot_period_place ON public.leaderboard_snapshot (period, place);
REVOKE ALL ON public.leaderboard_snapshot FROM anon, authenticated;
GRANT SELECT ON public.leaderboard_snapshot TO anon, authenticated;
GRANT ALL ON public.leaderboard_snapshot TO service_role;
ALTER TABLE public.leaderboard_snapshot ENABLE ROW LEVEL SECURITY;
CREATE POLICY leaderboard_snapshot_public_read ON public.leaderboard_snapshot FOR SELECT TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION public.refresh_leaderboard_snapshot()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM leaderboard_snapshot WHERE period IN ('week','all');
  INSERT INTO leaderboard_snapshot (period, place, display_name, reads)
  SELECT p.period, rank() OVER (PARTITION BY p.period ORDER BY count(*) DESC)::int, pr.display_name, count(*)::int
  FROM (VALUES ('week'), ('all')) AS p(period)
  JOIN topic_reads r ON p.period = 'all' OR r.read_at >= date_trunc('week', now())
  JOIN profiles pr ON pr.id = r.user_id
  GROUP BY p.period, r.user_id, pr.display_name;
END $$;
REVOKE ALL ON FUNCTION public.refresh_leaderboard_snapshot() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_leaderboard_snapshot() TO service_role;

CREATE OR REPLACE FUNCTION public.leaderboard_snapshot_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.refresh_leaderboard_snapshot();
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.leaderboard_snapshot_trigger() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER topic_reads_refresh_leaderboard AFTER INSERT OR UPDATE OR DELETE ON public.topic_reads
  FOR EACH STATEMENT EXECUTE FUNCTION public.leaderboard_snapshot_trigger();
CREATE TRIGGER profiles_refresh_leaderboard AFTER UPDATE OF display_name OR DELETE ON public.profiles
  FOR EACH STATEMENT EXECUTE FUNCTION public.leaderboard_snapshot_trigger();

-- Own place only: own reads via RLS, compared against public snapshot totals.
CREATE OR REPLACE FUNCTION public.my_leaderboard_place(_period text DEFAULT 'week')
RETURNS TABLE(place integer, reads integer)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH mine AS (
    SELECT count(*)::int AS n FROM topic_reads r
    WHERE r.user_id = auth.uid()
      AND (_period <> 'week' OR r.read_at >= date_trunc('week', now()))
  )
  SELECT (SELECT count(*)::int + 1 FROM leaderboard_snapshot s WHERE s.period = CASE WHEN _period = 'week' THEN 'week' ELSE 'all' END AND s.reads > m.n), m.n
  FROM mine m WHERE auth.uid() IS NOT NULL AND m.n > 0;
$$;
REVOKE ALL ON FUNCTION public.my_leaderboard_place(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_leaderboard_place(text) TO authenticated;

DROP FUNCTION IF EXISTS public.leaderboard(text, integer);
SELECT public.refresh_leaderboard_snapshot();

-- 3. Baseline maintenance
CREATE TABLE public.content_health_baseline_changes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  changed_at timestamptz NOT NULL DEFAULT now(),
  old_baselines jsonb NOT NULL,
  new_baselines jsonb NOT NULL
);
REVOKE ALL ON public.content_health_baseline_changes FROM anon, authenticated;
GRANT SELECT, INSERT ON public.content_health_baseline_changes TO authenticated;
GRANT ALL ON public.content_health_baseline_changes TO service_role;
ALTER TABLE public.content_health_baseline_changes ENABLE ROW LEVEL SECURITY;
CREATE POLICY baseline_changes_editor_read ON public.content_health_baseline_changes FOR SELECT TO authenticated USING (public.is_editor());
CREATE POLICY baseline_changes_editor_insert ON public.content_health_baseline_changes FOR INSERT TO authenticated WITH CHECK (public.is_editor());
GRANT UPDATE (baseline, updated_at) ON public.content_health_baselines TO authenticated;
CREATE POLICY health_baselines_editor_update ON public.content_health_baselines FOR UPDATE TO authenticated USING (public.is_editor()) WITH CHECK (public.is_editor());

CREATE OR REPLACE FUNCTION public.content_health_current_totals()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_editor() THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'published_topics', (SELECT count(*) FROM content_topics WHERE status='published'),
    'approved_sources', (SELECT count(*) FROM content_resources r JOIN content_topics t ON t.id=r.topic_id WHERE r.review_status='approved' AND t.status='published'),
    'published_categories', (SELECT count(DISTINCT category) FROM content_topics WHERE status='published'),
    'active_lanes', (SELECT count(*) FROM interest_lanes WHERE active));
END $$;
REVOKE ALL ON FUNCTION public.content_health_current_totals() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.content_health_current_totals() TO authenticated;

-- Applies only if the live totals still equal the previewed ones. No-op when unchanged.
CREATE OR REPLACE FUNCTION public.rebase_content_health_baselines(_expected jsonb)
RETURNS TABLE(changed boolean, reason text, old_baselines jsonb, new_baselines jsonb)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_now jsonb; v_old jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_editor() THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  v_now := public.content_health_current_totals();
  SELECT jsonb_object_agg(b.metric, b.baseline) INTO v_old FROM content_health_baselines b;
  IF _expected IS DISTINCT FROM v_now THEN
    RETURN QUERY SELECT false, 'totals_changed_since_preview'::text, v_old, v_now; RETURN;
  END IF;
  IF v_old = (SELECT jsonb_object_agg(k, v_now -> k) FROM jsonb_object_keys(v_old) k) THEN
    RETURN QUERY SELECT false, 'already_current'::text, v_old, v_old; RETURN;
  END IF;
  UPDATE content_health_baselines b SET baseline = (v_now ->> b.metric)::int, updated_at = now()
   WHERE v_now ? b.metric;
  INSERT INTO content_health_baseline_changes(old_baselines, new_baselines)
  SELECT v_old, jsonb_object_agg(b.metric, b.baseline) FROM content_health_baselines b;
  RETURN QUERY SELECT true, 'ok'::text, v_old, (SELECT jsonb_object_agg(b.metric, b.baseline) FROM content_health_baselines b);
END $$;
REVOKE ALL ON FUNCTION public.rebase_content_health_baselines(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rebase_content_health_baselines(jsonb) TO authenticated;