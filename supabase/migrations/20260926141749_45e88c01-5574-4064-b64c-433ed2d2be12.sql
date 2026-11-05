ALTER FUNCTION public.run_content_health_check(text) SECURITY INVOKER;
GRANT INSERT ON public.content_health_checks TO authenticated;
GRANT INSERT, UPDATE ON public.content_health_incidents TO authenticated;
CREATE POLICY health_checks_editor_insert ON public.content_health_checks FOR INSERT TO authenticated WITH CHECK (public.is_editor());
CREATE POLICY health_incidents_editor_insert ON public.content_health_incidents FOR INSERT TO authenticated WITH CHECK (public.is_editor());
CREATE POLICY health_incidents_editor_update ON public.content_health_incidents FOR UPDATE TO authenticated USING (public.is_editor()) WITH CHECK (public.is_editor());