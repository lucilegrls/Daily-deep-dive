DROP FUNCTION IF EXISTS public.apply_onboarding(text[], text, text, boolean);

CREATE OR REPLACE FUNCTION public.apply_onboarding(_interests text[], _feed_mix text, _theme text, _force boolean DEFAULT false)
 RETURNS TABLE(applied boolean, onboarded boolean, reason text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _already boolean;
  _mix text := CASE WHEN lower(coalesce(_feed_mix, '')) IN ('focused','balanced','exploratory')
                    THEN lower(_feed_mix) ELSE 'balanced' END;
  _valid_themes text[] := ARRAY['romantic','minimal','inky','maximal','retro','y2k','academia'];
  _next_theme text := CASE WHEN coalesce(_theme, '') = ANY(_valid_themes) THEN _theme ELSE NULL END;
  _clean text[];
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  INSERT INTO public.profiles (id) VALUES (_uid) ON CONFLICT (id) DO NOTHING;
  SELECT p.onboarded INTO _already FROM public.profiles p WHERE p.id = _uid;

  IF _already AND NOT coalesce(_force, false) THEN
    RETURN QUERY SELECT false, true, 'already_onboarded'::text;
    RETURN;
  END IF;

  SELECT coalesce(array_agg(DISTINCT c.category), '{}'::text[])
    INTO _clean
  FROM public.content_topics c
  WHERE c.status = 'published'
    AND c.category = ANY(coalesce(_interests, '{}'::text[]));

  -- At least three real published subjects, checked server-side. When the
  -- request falls short nothing is written: existing interests, theme, feed
  -- mix and onboarding state stay exactly as they were.
  IF coalesce(array_length(_clean, 1), 0) < 3 THEN
    RETURN QUERY SELECT false, coalesce(_already, false), 'too_few_interests'::text;
    RETURN;
  END IF;

  DELETE FROM public.user_interests WHERE user_id = _uid;
  INSERT INTO public.user_interests (user_id, subject)
  SELECT _uid, unnest(_clean)
  ON CONFLICT DO NOTHING;

  UPDATE public.profiles
     SET feed_mix = _mix,
         theme = coalesce(_next_theme, theme),
         onboarded = true,
         updated_at = now()
   WHERE id = _uid;

  RETURN QUERY SELECT true, true, 'ok'::text;
END;
$function$;

REVOKE ALL ON FUNCTION public.apply_onboarding(text[], text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_onboarding(text[], text, text, boolean) TO authenticated;