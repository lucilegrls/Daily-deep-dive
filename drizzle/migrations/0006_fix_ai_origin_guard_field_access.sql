CREATE OR REPLACE FUNCTION public.ai_origin_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  publishing boolean := false;
BEGIN
  IF NEW.origin NOT ILIKE 'ai%' THEN
    RETURN NEW;
  END IF;
  -- Read only the column that exists on this table (PL/pgSQL does not short-circuit record field lookups).
  IF TG_TABLE_NAME = 'content_topics' THEN
    publishing := (to_jsonb(NEW) ->> 'status') = 'published';
  ELSIF TG_TABLE_NAME = 'content_resources' THEN
    publishing := (to_jsonb(NEW) ->> 'review_status') = 'approved';
  END IF;
  IF publishing AND auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AI-originated content needs an editor to approve or publish it';
  END IF;
  IF publishing AND NOT public.is_editor() THEN
    RAISE EXCEPTION 'Only editors may approve AI-originated content';
  END IF;
  RETURN NEW;
END $$;