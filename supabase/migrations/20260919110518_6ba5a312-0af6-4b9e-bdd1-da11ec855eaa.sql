REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;

REVOKE EXECUTE ON FUNCTION public.is_editor() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_editor() TO authenticated, service_role;