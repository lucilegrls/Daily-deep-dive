CREATE OR REPLACE FUNCTION public.run_content_health_check(_source text DEFAULT 'scheduled')
RETURNS TABLE(metric text, observed integer, threshold integer, healthy boolean)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
#variable_conflict use_column
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

  FOR b IN SELECT hb.metric AS m, hb.baseline AS base, hb.tolerance AS tol FROM content_health_baselines hb ORDER BY hb.metric LOOP
    v_obs := (v_totals ->> b.m)::integer;
    v_thr := ceil(b.base * (1 - b.tol))::integer;
    IF v_obs < v_thr THEN
      v_all_ok := false;
      INSERT INTO content_health_incidents AS i (metric, baseline, threshold, observed, lowest_observed)
      VALUES (b.m, b.base, v_thr, v_obs, v_obs)
      ON CONFLICT (metric) WHERE status = 'open' DO UPDATE
        SET observed = EXCLUDED.observed,
            lowest_observed = LEAST(i.lowest_observed, EXCLUDED.observed),
            seen_count = i.seen_count + 1,
            last_seen_at = now();
    ELSE
      UPDATE content_health_incidents i
         SET status = 'resolved', resolved_at = now(), resolved_observed = v_obs
       WHERE i.metric = b.m AND i.status = 'open';
    END IF;
    metric := b.m; observed := v_obs; threshold := v_thr; healthy := v_obs >= v_thr;
    RETURN NEXT;
  END LOOP;

  INSERT INTO content_health_checks(source, totals, healthy)
  VALUES (CASE WHEN _source = 'editor' THEN 'editor' ELSE 'scheduled' END, v_totals, v_all_ok);
END $$;
REVOKE ALL ON FUNCTION public.run_content_health_check(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.run_content_health_check(text) TO authenticated, service_role;