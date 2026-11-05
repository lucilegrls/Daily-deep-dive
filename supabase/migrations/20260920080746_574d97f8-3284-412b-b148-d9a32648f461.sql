REVOKE ALL ON public.interest_lanes FROM anon, authenticated;
REVOKE ALL ON public.interest_lane_categories FROM anon, authenticated;

GRANT SELECT ON public.interest_lanes TO anon;
GRANT SELECT ON public.interest_lane_categories TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.interest_lanes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interest_lane_categories TO authenticated;