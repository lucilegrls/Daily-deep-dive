-- Replace the 13 overlapping onboarding lanes with seven durable subjects.
-- Detailed editorial categories remain on topics for search and curation, but
-- readers see only this smaller, mutually understandable navigation set.

INSERT INTO public.interest_lanes
  (slug, label, description, examples, position, active)
VALUES
  ('science-technology', 'Science, technology & AI',
   'The living world, scientific discovery and the technology changing it.',
   ARRAY['biology', 'space', 'mathematics', 'AI', 'engineering'], 1, true),
  ('health-mind', 'Health, body & mind',
   'Physical health, the brain, psychology and performance.',
   ARRAY['nutrition', 'hormones', 'memory', 'mental health', 'fitness'], 2, true),
  ('business-economy', 'Business, money & economics',
   'Money, markets and how organisations work.',
   ARRAY['personal finance', 'markets', 'business', 'marketing'], 3, true),
  ('society-culture', 'Society, culture & politics',
   'Ideas, history, law, culture and institutions.',
   ARRAY['history', 'art', 'politics', 'law', 'ethics'], 4, true),
  ('learning-work', 'Learning, focus & work',
   'How we learn, create and do better work.',
   ARRAY['study', 'attention', 'productivity', 'creativity'], 5, true),
  ('nature-everyday', 'Nature & everyday questions',
   'Animals, the natural world and ordinary things worth understanding.',
   ARRAY['animals', 'nature', 'everyday science'], 6, true),
  ('world-travel', 'World, food & travel',
   'Places, food and the cultures around them.',
   ARRAY['Southeast Asia', 'food', 'travel', 'cities'], 7, true)
ON CONFLICT (slug) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  examples = EXCLUDED.examples,
  position = EXCLUDED.position,
  active = true;

UPDATE public.interest_lanes
SET active = false
WHERE slug IN (
  'body-health-nutrition',
  'brain-behavior',
  'fitness-performance',
  'learning-focus',
  'economics-investing',
  'business-marketing',
  'law-tax-offshore',
  'politics-history-geopolitics',
  'technology-ai',
  'mathematics-scientific-thinking',
  'art-culture-society',
  'animals-nature-why',
  'southeast-asia-food-travel'
);

DELETE FROM public.interest_lane_categories
WHERE lane_slug IN (
  'science-technology', 'health-mind', 'business-economy',
  'society-culture', 'learning-work', 'nature-everyday', 'world-travel'
);

INSERT INTO public.interest_lane_categories (lane_slug, category) VALUES
  ('science-technology', 'AI & LLMs'),
  ('science-technology', 'Biochemistry & biology'),
  ('science-technology', 'Mathematics'),
  ('science-technology', 'Recent promising research'),
  ('science-technology', 'Science & technology'),
  ('health-mind', 'Fitness & performance'),
  ('health-mind', 'Health & nutrition'),
  ('health-mind', 'Menstrual health & hormones'),
  ('health-mind', 'Neuroscience & the brain'),
  ('health-mind', 'Psychology & behavior'),
  ('business-economy', 'Finance & economics'),
  ('business-economy', 'Marketing & business'),
  ('society-culture', 'Art & culture'),
  ('society-culture', 'Digital rights & law'),
  ('society-culture', 'History'),
  ('society-culture', 'Law'),
  ('society-culture', 'Philosophy & ethics'),
  ('society-culture', 'Politics & institutions'),
  ('learning-work', 'Learning & study'),
  ('learning-work', 'Productivity & focus'),
  ('nature-everyday', 'Animals & nature'),
  ('nature-everyday', 'Everyday why'),
  ('world-travel', 'Food & travel'),
  ('world-travel', 'Southeast Asian tourism')
ON CONFLICT DO NOTHING;

-- Remove the two known duplicate spellings at the source, rather than merely
-- hiding one of them in the interface.
UPDATE public.content_topics
SET category = 'Science & technology'
WHERE lower(trim(category)) = 'science & technology';

UPDATE public.content_topics
SET category = 'Finance & economics'
WHERE lower(trim(category)) IN (
  'finance & economics',
  'economics & personal finance'
);

-- Keep existing readers' choices meaningful after the consolidation. Insert
-- first (to respect the composite primary key), then remove obsolete subjects.
INSERT INTO public.user_interests (user_id, subject)
SELECT DISTINCT
  user_id,
  CASE
    WHEN subject IN ('technology-ai', 'mathematics-scientific-thinking')
      THEN 'science-technology'
    WHEN subject IN ('body-health-nutrition', 'brain-behavior', 'fitness-performance')
      THEN 'health-mind'
    WHEN subject IN ('economics-investing', 'business-marketing')
      THEN 'business-economy'
    WHEN subject IN ('law-tax-offshore', 'politics-history-geopolitics', 'art-culture-society')
      THEN 'society-culture'
    WHEN subject = 'learning-focus' THEN 'learning-work'
    WHEN subject = 'animals-nature-why' THEN 'nature-everyday'
    WHEN subject = 'southeast-asia-food-travel' THEN 'world-travel'
  END
FROM public.user_interests
WHERE subject IN (
  'body-health-nutrition', 'brain-behavior', 'fitness-performance',
  'learning-focus', 'economics-investing', 'business-marketing',
  'law-tax-offshore', 'politics-history-geopolitics', 'technology-ai',
  'mathematics-scientific-thinking', 'art-culture-society',
  'animals-nature-why', 'southeast-asia-food-travel'
)
ON CONFLICT DO NOTHING;

DELETE FROM public.user_interests
WHERE subject IN (
  'body-health-nutrition', 'brain-behavior', 'fitness-performance',
  'learning-focus', 'economics-investing', 'business-marketing',
  'law-tax-offshore', 'politics-history-geopolitics', 'technology-ai',
  'mathematics-scientific-thinking', 'art-culture-society',
  'animals-nature-why', 'southeast-asia-food-travel'
);
