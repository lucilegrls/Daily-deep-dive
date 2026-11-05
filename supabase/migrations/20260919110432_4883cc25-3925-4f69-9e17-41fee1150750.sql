CREATE OR REPLACE FUNCTION public.is_safe_source_url(_url text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE
  authority text;
  host text;
BEGIN
  IF _url IS NULL THEN RETURN false; END IF;
  IF _url !~* '^https?://' THEN RETURN false; END IF;

  authority := split_part(regexp_replace(_url, '^https?://', '', 'i'), '/', 1);
  authority := split_part(split_part(authority, '?', 1), '#', 1);
  authority := regexp_replace(authority, '^.*@', '');
  host := lower(split_part(authority, ':', 1));
  host := btrim(host);
  host := replace(replace(host, '[', ''), ']', '');
  host := regexp_replace(host, '[.]+$', '');

  IF host = '' OR host ~ '\s' THEN RETURN false; END IF;

  IF host IN ('wikipedia.org', 'wikimedia.org', 'wikiwand.com', 'wikibooks.org',
              'wikisource.org', 'wikiquote.org', 'wikidata.org', 'wiktionary.org',
              'dbpedia.org')
     OR host LIKE '%.wikipedia.org'
     OR host LIKE '%.wikimedia.org'
     OR host LIKE '%.wikiwand.com'
     OR host LIKE '%.wikibooks.org'
     OR host LIKE '%.wikisource.org'
     OR host LIKE '%.wikiquote.org'
     OR host LIKE '%.wikidata.org'
     OR host LIKE '%.wiktionary.org'
     OR host LIKE '%.dbpedia.org'
  THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$function$;