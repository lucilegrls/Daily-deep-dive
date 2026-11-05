ALTER FUNCTION public.feed_topics(text, text, text[], integer[], integer, integer, integer, text) SECURITY INVOKER;
ALTER FUNCTION public.feed_topics(text, text, text[], integer[], integer, integer, integer) SECURITY INVOKER;
ALTER FUNCTION public.search_topics(text, text, integer, integer) SECURITY INVOKER;
ALTER FUNCTION public.is_editor() SECURITY INVOKER;
ALTER FUNCTION public.apply_onboarding(text[], text, text, boolean) SECURITY INVOKER;
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;
ALTER EXTENSION pg_trgm SET SCHEMA extensions;