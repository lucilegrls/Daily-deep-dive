CREATE TABLE public.interest_lanes (
  slug text PRIMARY KEY,
  label text NOT NULL,
  description text NOT NULL DEFAULT '',
  examples text[] NOT NULL DEFAULT '{}'::text[],
  position integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.interest_lanes TO anon, authenticated;
GRANT ALL ON public.interest_lanes TO service_role;
ALTER TABLE public.interest_lanes ENABLE ROW LEVEL SECURITY;
CREATE POLICY lanes_public_read ON public.interest_lanes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY lanes_editor_write ON public.interest_lanes FOR ALL TO authenticated USING (is_editor()) WITH CHECK (is_editor());

CREATE TABLE public.interest_lane_categories (
  lane_slug text NOT NULL REFERENCES public.interest_lanes(slug) ON DELETE CASCADE,
  category text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (lane_slug, category)
);

GRANT SELECT ON public.interest_lane_categories TO anon, authenticated;
GRANT ALL ON public.interest_lane_categories TO service_role;
ALTER TABLE public.interest_lane_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY lane_categories_public_read ON public.interest_lane_categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY lane_categories_editor_write ON public.interest_lane_categories FOR ALL TO authenticated USING (is_editor()) WITH CHECK (is_editor());

CREATE TRIGGER interest_lanes_touch BEFORE UPDATE ON public.interest_lanes
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.interest_lanes (slug, label, description, examples, position) VALUES
 ('body-health-nutrition','Body, health & nutrition','How the body actually works, from cells to daily habits.', ARRAY['iron','vitamins','hormones','fertility','gut health','cells'],1),
 ('brain-behavior','Brain, psychology & behavior','Why minds do what they do.', ARRAY['dopamine','memory','stress','pain','addiction','consciousness'],2),
 ('fitness-performance','Fitness & performance','Training, recovery and what the evidence supports.', ARRAY['muscle growth','creatine','collagen','recovery','anabolic steroids'],3),
 ('learning-focus','Learning & focus','How we learn, remember and hold attention.', ARRAY['attention','study methods','memory','habits','task switching'],4),
 ('economics-investing','Economics, finance & investing','Money, markets and the machinery behind them.', ARRAY['bonds','inflation','banking','markets','valuation'],5),
 ('business-marketing','Business & marketing','How businesses grow and how they persuade.', ARRAY['consumer behavior','pricing','branding','strategy','dark patterns'],6),
 ('law-tax-offshore','Law, tax & offshore','Rules, structures and the money that moves between them.', ARRAY['IP','corporate law','treaties','foreign investment','cross-border structures'],7),
 ('politics-history-geopolitics','Politics, history & geopolitics','Power, institutions and the conflicts that shape them.', ARRAY['institutions','Vietnam War','diplomacy','conflicts'],8),
 ('technology-ai','Technology & AI','The systems the modern world runs on.', ARRAY['algorithms','semiconductors','internet infrastructure','AI provenance'],9),
 ('mathematics-scientific-thinking','Mathematics & scientific thinking','Reasoning, evidence and uncertainty.', ARRAY['probability','Bayes','chaos','experiments','replication'],10),
 ('art-culture-society','Art, culture & society','How people make meaning together.', ARRAY['art history','pigments','rituals','identity','child protection'],11),
 ('animals-nature-why','Animals, nature & everyday why','Living things and the questions nobody answers.', ARRAY['animal cognition','biology','everyday questions'],12),
 ('southeast-asia-food-travel','Southeast Asia, food & travel','Places, kitchens and the cultures around them.', ARRAY['Vietnam','tourism','food science','regional cultures'],13)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.interest_lane_categories (lane_slug, category) VALUES
 ('body-health-nutrition','Biochemistry & biology'),
 ('body-health-nutrition','Health & nutrition'),
 ('body-health-nutrition','Menstrual health & hormones'),
 ('brain-behavior','Psychology & behavior'),
 ('fitness-performance','Biochemistry & biology'),
 ('fitness-performance','Health & nutrition'),
 ('learning-focus','Learning & study'),
 ('learning-focus','Productivity & focus'),
 ('economics-investing','Finance & economics'),
 ('economics-investing','Economics & personal finance'),
 ('business-marketing','Marketing & business'),
 ('law-tax-offshore','Law'),
 ('law-tax-offshore','Digital rights & law'),
 ('politics-history-geopolitics','Politics & institutions'),
 ('technology-ai','AI & LLMs'),
 ('technology-ai','Digital rights & law'),
 ('mathematics-scientific-thinking','Recent promising research'),
 ('art-culture-society','Philosophy & ethics'),
 ('animals-nature-why','Biochemistry & biology')
ON CONFLICT DO NOTHING;

-- Translate a saved preference list into library categories. A value may be a
-- catalogue slug (mapped to its categories) or a legacy category string, which
-- is kept as-is so established readers keep the feed they chose.
CREATE OR REPLACE FUNCTION public.expand_interests(_interests text[])
RETURNS text[]
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT coalesce(array_agg(DISTINCT c), '{}'::text[])
  FROM (
    SELECT lc.category AS c
    FROM public.interest_lane_categories lc
    JOIN public.interest_lanes l ON l.slug = lc.lane_slug AND l.active
    WHERE lc.lane_slug = ANY(coalesce(_interests, '{}'::text[]))
    UNION
    SELECT t.category
    FROM public.content_topics t
    WHERE t.status = 'published'
      AND t.category = ANY(coalesce(_interests, '{}'::text[]))
  ) s;
$$;

GRANT EXECUTE ON FUNCTION public.expand_interests(text[]) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.feed_topics(_query text DEFAULT ''::text, _category text DEFAULT NULL::text, _interests text[] DEFAULT '{}'::text[], _read_ids integer[] DEFAULT '{}'::integer[], _seed integer DEFAULT 0, _limit integer DEFAULT 12, _offset integer DEFAULT 0, _mix text DEFAULT 'balanced'::text)
RETURNS TABLE(id integer, slug text, title text, category text, context text, takeaways text[], tags text[], last_verified date, total_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH cfg AS (
    SELECT CASE lower(coalesce(_mix, 'balanced'))
             WHEN 'focused' THEN 9
             WHEN 'exploratory' THEN 1
             ELSE 3
           END AS pref_per_other
  ), base AS (
    SELECT t.id, t.slug, t.title, t.category, t.context, t.takeaways, t.tags, t.last_verified,
           (t.id = ANY(coalesce(_read_ids, '{}'::integer[])))::int AS already_read,
           CASE WHEN t.category IN (SELECT unnest(public.expand_interests(_interests))) THEN 0 ELSE 1 END AS pref_rank
    FROM public.content_topics t
    WHERE t.status = 'published'
      AND (_category IS NULL OR t.category = _category)
      AND (coalesce(trim(_query), '') = '' OR t.search_text LIKE '%' || lower(trim(_query)) || '%')
  ), ordered AS (
    SELECT b.*,
           row_number() OVER (
             PARTITION BY b.already_read, b.pref_rank
             ORDER BY md5(b.id::text || ':' || coalesce(_seed, 0)::text)
           ) AS slot
    FROM base b
  )
  SELECT o.id, o.slug, o.title, o.category, o.context, o.takeaways, o.tags, o.last_verified,
         (SELECT count(*) FROM base) AS total_count
  FROM ordered o, cfg c
  ORDER BY o.already_read,
           CASE WHEN o.pref_rank = 0
                THEN (o.slot - 1) * (c.pref_per_other + 1) / c.pref_per_other
                ELSE (o.slot - 1) * (c.pref_per_other + 1) + c.pref_per_other
           END,
           o.pref_rank,
           o.id
  LIMIT least(coalesce(_limit, 12), 60) OFFSET greatest(coalesce(_offset, 0), 0);
$function$;

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

  -- A choice is valid when it is an active catalogue slug, or a legacy
  -- published category kept by an established reader.
  SELECT coalesce(array_agg(DISTINCT v), '{}'::text[])
    INTO _clean
  FROM (
    SELECT l.slug AS v
    FROM public.interest_lanes l
    WHERE l.active AND l.slug = ANY(coalesce(_interests, '{}'::text[]))
    UNION
    SELECT c.category
    FROM public.content_topics c
    WHERE c.status = 'published'
      AND c.category = ANY(coalesce(_interests, '{}'::text[]))
  ) s;

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