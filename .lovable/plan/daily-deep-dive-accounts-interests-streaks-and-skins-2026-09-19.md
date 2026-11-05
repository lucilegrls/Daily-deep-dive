# Daily Deep Dive — accounts, interests, streaks and skins

Turn the reading feed into a personal, competitive, theme-able app.

## 1. Accounts

- Sign up / sign in with email and password, plus Google sign-in.
- Each person gets a profile: display name, chosen look, and their interests.
- A short welcome flow right after sign-up: pick the subjects you care about
  most (the 15 existing subjects, shown as cards), pick a look, done.
- Reading without an account still works: the feed is public, but saving,
  streaks and the ranking ask you to sign in.

## 2. Personalised endless feed

- The feed keeps its current endless-scroll shape with the envelope on the side.
- Roughly three out of four envelopes come from your chosen subjects; the rest
  are drawn from everything else so you keep discovering.
- Topics you already read sink to the bottom rather than disappearing.
- A small "Tune my interests" link lets you change your picks any time.

## 3. Streaks and ranking

- Opening a topic and spending time in it counts as a read.
- A daily streak counter in the header: read at least one topic a day to keep
  it alive; it shows your current run and your best run.
- A leaderboard page: this week's most curious readers, by topics read, with
  your own position always visible. All-time tab as well.
- Room is left to add points, levels and badges later.

## 4. Six looks

One switch changes the whole app's colours, type and ornament:

- Romantic (the current lace and wax-seal look) — default
- Minimalist — quiet, white, almost no ornament
- Inky — dark, heavy serif, deep green and charcoal
- Maximalist — bold colour, pattern, oversized type
- Retro print — newsprint texture, warm off-white
- Y2K — chrome, gradients, bubble type
- Dark academia — oxblood, parchment, candlelight

Chosen during the welcome flow, changeable from a menu, remembered on your
account.

## 5. YouTube videos on every topic

Every one of the 64 topics gets at least one hand-picked YouTube video
alongside its books and papers, shown in the same paper-and-clip bibliography.
I will look up real videos rather than inventing links, and flag any topic
where I could not find a good one instead of filling it with something weak.

## Technical notes

- Enable Lovable Cloud for accounts and data. Tables: `profiles`
  (display_name, theme, onboarded), `user_interests` (user_id, subject),
  `topic_reads` (user_id, topic_id, read_at, seconds), and a
  `leaderboard_weekly` view. Row-level security throughout: you can only write
  your own rows; leaderboard reads go through a security-definer function that
  exposes display name and counts only — never emails.
- Streak computed from distinct `read_at` days in the user's timezone.
- Themes as CSS token sets in `src/styles.css` under `data-theme` attributes,
  applied on `<html>`; every component keeps using semantic tokens so no
  component markup changes per theme. Ornament differences (lace, rules, seal)
  driven by theme-scoped classes.
- Feed ranking done client-side over the existing `topics.json` with a seeded
  shuffle so the order is stable within a session.
- Videos appended to `topics.json` resources with `kind: "video"`,
  `lastVerified` set.

## Order of work

1. Cloud + accounts + profile table
2. Welcome flow (interests + look)
3. Theme system with the seven looks
4. Personalised feed ranking
5. Reads, streak, leaderboard
6. YouTube videos across the library
