
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT 'Reader',
  theme TEXT NOT NULL DEFAULT 'romantic',
  onboarded BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TABLE public.user_interests (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, subject)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_interests TO authenticated;
GRANT ALL ON public.user_interests TO service_role;
ALTER TABLE public.user_interests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "interests_own" ON public.user_interests FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.topic_reads (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id INTEGER NOT NULL,
  seconds INTEGER NOT NULL DEFAULT 0,
  read_day DATE NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX topic_reads_user_idx ON public.topic_reads (user_id, read_at DESC);
CREATE UNIQUE INDEX topic_reads_unique_day ON public.topic_reads (user_id, topic_id, read_day);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.topic_reads TO authenticated;
GRANT ALL ON public.topic_reads TO service_role;
ALTER TABLE public.topic_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reads_own" ON public.topic_reads FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(NEW.raw_user_meta_data ->> 'display_name', ''),
      NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''),
      split_part(COALESCE(NEW.email, 'reader'), '@', 1)
    )
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.leaderboard(_period TEXT DEFAULT 'week', _limit INTEGER DEFAULT 50)
RETURNS TABLE (user_id UUID, display_name TEXT, reads BIGINT, place BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.user_id,
    p.display_name,
    count(*) AS reads,
    rank() OVER (ORDER BY count(*) DESC) AS place
  FROM public.topic_reads r
  JOIN public.profiles p ON p.id = r.user_id
  WHERE _period <> 'week' OR r.read_at >= date_trunc('week', now())
  GROUP BY r.user_id, p.display_name
  ORDER BY reads DESC
  LIMIT _limit;
$$;

GRANT EXECUTE ON FUNCTION public.leaderboard(TEXT, INTEGER) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.streak_for(_user_id UUID)
RETURNS TABLE (current_streak INTEGER, best_streak INTEGER, total_reads BIGINT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d DATE;
  prev DATE;
  cur INTEGER := 0;
  best INTEGER := 0;
  running INTEGER := 0;
  today DATE := (now() AT TIME ZONE 'utc')::date;
BEGIN
  FOR d IN
    SELECT DISTINCT read_day AS day
    FROM public.topic_reads
    WHERE user_id = _user_id
    ORDER BY day DESC
  LOOP
    IF prev IS NULL THEN
      running := 1;
      IF d = today OR d = today - 1 THEN cur := 1; END IF;
    ELSIF prev - d = 1 THEN
      running := running + 1;
      IF cur > 0 AND cur = running - 1 THEN cur := running; END IF;
    ELSE
      running := 1;
    END IF;
    IF running > best THEN best := running; END IF;
    prev := d;
  END LOOP;

  RETURN QUERY
    SELECT cur, best, (SELECT count(*) FROM public.topic_reads WHERE user_id = _user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.streak_for(UUID) TO authenticated;
