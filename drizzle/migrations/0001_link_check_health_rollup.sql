-- A recorded link check updates only the technical health fields of its source.
-- It never changes review_status (approval) and never deletes anything.
CREATE OR REPLACE FUNCTION public.link_check_rollup()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE failed boolean := NEW.outcome IN ('broken','error');
BEGIN
  UPDATE content_resources r SET
    link_status = CASE NEW.outcome WHEN 'ok' THEN 'ok' WHEN 'redirected' THEN 'redirected'
                   WHEN 'broken' THEN 'broken' WHEN 'blocked' THEN 'blocked' ELSE 'error' END,
    access_level = coalesce(NEW.access_level, r.access_level),
    consecutive_failures = CASE WHEN failed THEN r.consecutive_failures + 1 ELSE 0 END,
    needs_review = r.needs_review OR (failed AND r.consecutive_failures + 1 >= 2) OR NEW.outcome = 'redirected',
    needs_review_reason = CASE
      WHEN r.needs_review THEN r.needs_review_reason
      WHEN failed AND r.consecutive_failures + 1 >= 2 THEN 'Link failed on repeated checks'
      WHEN NEW.outcome = 'redirected' THEN 'Link now redirects elsewhere'
      ELSE r.needs_review_reason END,
    last_checked_at = NEW.checked_at,
    next_check_at = NEW.checked_at + CASE WHEN failed THEN interval '2 days' ELSE interval '30 days' END
  WHERE r.id = NEW.resource_id;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.link_check_rollup() FROM PUBLIC, anon;
DROP TRIGGER IF EXISTS link_check_rollup ON public.source_link_checks;
CREATE TRIGGER link_check_rollup AFTER INSERT OR UPDATE ON public.source_link_checks
  FOR EACH ROW EXECUTE FUNCTION public.link_check_rollup();
CREATE INDEX IF NOT EXISTS content_resources_next_check_idx ON public.content_resources (next_check_at) WHERE review_status <> 'rejected';