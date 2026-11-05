# Implementation status — 19 September 2026

## Done this round

- Content backend: `content_topics`, `content_resources`, `saved_topics`,
  `topic_notes`, `editorial_runs`, `topic_backlog`, `user_roles` with
  `has_role` / `is_editor`. Row-level security throughout; readers only ever see
  published topics and approved sources. Link safety enforced in the database.
- Imported from the repository library: **64 topics, 102 sources, 0 refused,
  0 Wikipedia links**, keeping the original numeric ids. **188 backlog ideas**
  imported from `EDITORIAL_TOPIC_MAP.md`, plus the **220 reviewed topic
  directions** from the 19 September handoff (11 groups of 20, Everyday Why
  permanent), with their mechanism notes and provenance. Backlog total: 408.
- Feed, search and filters read from the backend with server-side pagination.
  The order is decided by the database across the whole published bank
  (`feed_topics`): preferred subjects mixed roughly three to one with the rest,
  already-read topics last, jittered by the day. Loading another page appends
  to that order and never reshuffles rows already on screen.
- Cloud saved topics. Saves made before signing in stay on the device under
  their own key and are never merged automatically; the Saved view offers an
  explicit "Add them to this account" action, and the device list is cleared
  only after the save succeeds. Switching account clears the previous list
  immediately and late replies from the old account are discarded.
- Saved topics honour the search box and the subject filter, with no cap on
  how many saved topics are looked up.
- Private per-topic notes are tied to (reader, topic): the box stays disabled
  until the right note has loaded, a note can never be saved under the wrong
  topic or account, and "Saved" is only shown after a successful write.
- Reads count after 15 seconds of visible dwell, not on click.
- Editor's desk at `/editor` (editors and owner only).
- Shareable topic pages at `/topic/<slug>`.
- Private editorial fields (editorial notes, provenance, credibility notes,
  selection reasons, rejection reasons) now live in separate editor-only
  tables. The public tables grant readers only the safe columns, so the direct
  data API cannot return internal review material either. Verification
  disclosures readers are meant to see remain public.
- Link safety is normalised identically in the database and in the app:
  case, ports, userinfo and trailing dots are stripped before the host is
  checked, so `https://en.wikipedia.org./wiki/Iron` is refused. 21 focused
  tests cover this (`src/lib/content-safety.test.ts`, `bunx vitest run`).
- Reimporting the repository library is non-destructive: existing topics keep
  their editorial status, title, context and publication date. Failed writes
  are counted and reported instead of being passed off as duplicates.
- The draft-expansion queue claims the ideas it takes and marks them drafted,
  releasing anything it did not use, so a rerun moves forward instead of taking
  the same entries again. No model was called and no schedule was activated.
- Removed resource counts, the word "resources" and the "open the envelope"
  helper line from the feed; removed the "reviewed by a human" claims.

## Blockers and gaps (honest)

1. **Video coverage: 1 of 64 topics.** Filling it needs real viewing and
   judgement per topic; nothing was auto-filled.
2. **No scheduled daily job has run.** The endpoint
   `POST /api/public/editorial/daily-expansion` is complete and authenticated
   with the workspace cron secret, but no schedule has been configured or
   exercised, so daily publication must not be described as active.
3. **The daily expansion drafts topics only.** It cannot verify sources, so its
   suggestions land as candidates for review.
4. **No editor account exists yet.** A row in `user_roles` with role `owner` is
   needed for Lucile's account before `/editor` opens. Sign-up never grants it.
5. **The 220 reviewed topic directions are now stored** in the editor backlog.
   None is published: each still needs context, takeaways, credible sources and
   at least one strong video before it can go live.
6. **The in-app AI companion is documented only**
   (`docs/AI_COMPANION_PLAN.md`). No provider is connected and no reader text
   is sent anywhere; a named provider and Lucile's approval are required first.

## Roadmap, documented not built

Spaced repetition, reading progress beyond streaks, difficulty and depth
labels, start-here links, deeper offline/PWA support, points and badges.

## Guided onboarding journey (20 September 2026)

Routes changed/added:
- `src/routes/index.tsx` — signed-out landing hero ("Build my feed" / "Browse the
  library" anchored to `#library`), signed-in readers keep a compact header and
  go straight to their feed. Feed query now carries the reader's feed mix.
- `src/routes/start.tsx` (new, public) — four-step wizard for new readers.
- `src/routes/_authenticated/welcome.tsx` — now the same wizard in edit mode
  ("Tune my interests"), prefilled with the account's current values, Save/Cancel.
- `src/components/OnboardingWizard.tsx` (new), `src/lib/onboarding.ts` (new).

Preference fields added:
- `profiles.feed_mix` (`focused` | `balanced` | `exploratory`, default `balanced`,
  CHECK constrained).
- `feed_topics(..., _mix text default 'balanced')` — preferred-to-other ratio
  9:1 / 3:1 / 1:1 decided server-side over the whole bank, so pagination still
  never reshuffles loaded rows.
- `apply_onboarding(_interests, _feed_mix, _theme, _force)` — SECURITY DEFINER,
  EXECUTE granted to `authenticated` only. Idempotent: it refuses to touch an
  already-onboarded profile unless `_force` (explicit edit mode). Interests are
  intersected with published categories, so only canonical values are stored. It
  cannot grant any role.

Browser draft: `daily-deep-dive:onboarding-draft`, version 1, 24-hour expiry,
holds only canonical interests, feed mix, theme and a timestamp. Applied once by
the account provider when a profile is not yet onboarded, then removed; a stale
draft found on an established account is discarded without writing.

Tests run:
- `bunx vitest run` — 28 passing (7 new draft tests: expiry, version, junk,
  duplicate/non-string interests, unknown mix fallback, no account data carried).
- Feed mix ordering checked live against the database with one subject selected:
  focused 11/12, balanced 9/12, exploratory 6/12 preferred topics in the first page.
- Playwright, 390px viewport: both landing CTAs present, wizard reached, 15 real
  subject cards from the backend, minimum-3 validation announced via aria-live,
  3 feed-mix radios, 7 theme radios with live theme application (`data-theme=inky`),
  3 real preview topics, draft written with only non-sensitive fields, hand-off to
  `/auth`, keyboard tabbing reaches the choice cards, no page errors.
- Counts unchanged: 64 published topics, 102 source links, 408 backlog ideas.

Limitations:
- The email-confirmation and Google return paths are covered by the same provider
  code path (draft applied on first profile load) and were exercised via the draft
  unit tests and a manual wizard run, not an end-to-end signed-in browser test —
  no account was created for this task.
- The database linter still reports the project's intentional SECURITY DEFINER
  functions (feed, search, streak, roles, and now `apply_onboarding`); each is
  granted only to the roles that need it.

### Onboarding hardening pass (20 September 2026)

- **Stale drafts.** When a signed-in profile is already onboarded, the local
  onboarding draft is deleted on load without being applied, so a draft left by
  one browser session can never reach a different or later account. A valid
  draft is still applied once, only to the signed-in reader's not-yet-onboarded
  profile, and is also dropped whenever the server refuses it.
- **Strict look validation.** The seven ids live in one place
  (`THEME_IDS` in `src/lib/themes.ts`, with `isTheme` accepting `unknown`). The
  draft parser drops an unknown look (stored as "", meaning "keep the profile's
  look"), `setTheme`/`previewTheme` ignore invalid ids, and `apply_onboarding`
  accepts only those exact seven ids — anything else leaves the profile's
  current/default look untouched.
- **Server-side minimum of three subjects.** `apply_onboarding` now normalises
  the request against published categories and, if fewer than three distinct
  canonical subjects remain, writes nothing at all (interests, theme, feed mix
  and onboarding state unchanged) and returns
  `(applied=false, reason='too_few_interests')`. The wizard shows that message
  and returns the reader to the subject step. All writes stay inside the single
  function call.
- **Edit-mode look preview.** Choosing a look inside the wizard previews it
  locally only; nothing is written until Save, which commits look, subjects and
  feed mix together. Cancel restores the previous look on screen with no network
  write. Sign-up mode keeps its live preview and draft behaviour.

Verification: `bunx tsgo --noEmit` clean; `bunx vitest run` — 31 tests passing in
2 files (10 onboarding, including the new valid/invalid look cases and the seven
real ids; 21 content safety). SQL check of the normalisation rule: a request of
two real subjects plus junk keeps 2 canonical subjects and does not qualify,
three real subjects keeps 3 and qualifies. Browser walkthrough at 390px: both
landing CTAs, 15 real subjects, minimum-3 message announced, 3 feed-mix radios,
7 look radios with live preview, 3 real preview topics, draft holding only
subjects/mix/look/timestamp, hand-off to `/auth`, no page errors. Counts
unchanged: 64 published topics, 102 source links, 408 backlog ideas.

Remaining limitations: the real email-confirmation round trip and the real
Google OAuth round trip have still NOT been exercised end to end — no account
was created for this work, so the draft hand-off across those redirects is
covered only by unit tests and the shared apply-on-first-load code path. The
`too_few_interests` and `already_onboarded` refusals were verified by reading
and reasoning over the SQL plus the normalisation query above, not by calling
the function as a signed-in user. Database linter warnings for the project's
intentional SECURITY DEFINER functions remain, each granted only to the roles
that need it.

## Subject catalogue and priority backlog audit (2026-09-20)

Added `interest_lanes` and `interest_lane_categories` (public read, editor
write) with the 13 agreed lanes and their mappings to the 15 published
categories; four lanes (mathematics & scientific thinking, art/culture/society,
animals/nature/everyday why, Southeast Asia/food/travel) have no published
category yet and are labelled as still being written. `expand_interests` maps a
lane to its categories and passes legacy category strings through unchanged;
`feed_topics` now runs over the expanded set, keeping the three mixes and
deterministic pagination; `apply_onboarding` accepts an active lane slug or a
legacy published category and still requires three distinct valid choices,
atomically, with strict theme and feed-mix validation.

Priority directions audit: 12 new, non-duplicate backlog ideas added
idempotently under "Vietnam War & geopolitics" (7) and "Current conflicts —
date-sensitive" (5), source `Priority directions audit · 2026-09-20`. Every
date-sensitive entry carries a note that facts and status must be re-verified
against current primary/official or high-quality specialist sources immediately
before drafting or publication. These are editorial directions only, not
published content and not current-status claims. Backlog: 408 → 420 ideas; the
220 approved bank titles (groups A–K) and the 188 earlier map ideas are intact
and unduplicated.

Verification: `bunx tsgo --noEmit` clean; `bunx vitest run` — 38 tests in 3
files (7 new catalogue tests: lane→category mapping, legacy passthrough,
invalid values, a lane with no published topics, minimum-three with duplicates,
legacy preselection, label fallback). SQL: with three lanes chosen, 11 of the
first 12 feed rows are in the mapped categories under Focused and 6 under
Exploratory; a legacy `Law` interest still returns 6 mapped rows. Browser
walkthrough at 390px: 13 lane cards with descriptions and examples, three
selected, 3 feel radios, 7 look radios, 3 real preview topics, keyboard focus
works, no page errors. Published content unchanged: 64 topics, 102 resources.

Backlog is not published content: none of the 420 ideas is visible to readers
until it has context, takeaways, credible sources, at least one genuinely
educational video, no Wikipedia, and human approval.

## 2026-09-20 — onboarding simplified, first 10-topic batch published

Onboarding: the wizard cards now show only the 13 broad lane names and one-line
descriptions. Individual topic titles are no longer listed during registration;
they are discovered in the library itself. The "still being written" disclosure
for lanes without published content, the minimum-three rule, mapped feed logic,
accessibility and mobile layout are unchanged. `listInterestLanes` still returns
`examples`; the wizard simply no longer renders them.

First content-expansion batch (10 topics, IDs 65–74, origin
`editorial-batch-2026-09-20`): dopamine and prediction error; muscle
hypertrophy; creatine and its disputed brain claims; collagen synthesis; the
glymphatic system; how banks create money; why onions make us cry; how
octopuses think with their arms; Renaissance perspective; corporate tax
residence. Each has context, 5 takeaways, tags, difficulty, a category mapped to
existing interest lanes, and 3–5 resources (42 new resources total: at least one
mechanism-explaining video and at least one primary/peer-reviewed/official
source each). Contested claims are framed honestly — glymphatic flow as a
contested hypothesis with a critical review cited, creatine cognition as
equivocal via the McMorris systematic review, tax residence as jurisdiction- and
treaty-dependent. The 10 matching `topic_backlog` rows were marked `published`;
no backlog ideas were duplicated or created.

New categories added and mapped to existing lanes: Neuroscience & the brain and
Fitness & performance (brain-behavior, fitness-performance,
body-health-nutrition), Everyday why and Animals & nature (animals-nature-why),
Art & culture (art-culture-society). Biochemistry & biology, Finance &
economics and Law already existed. No existing topic or mapping was renamed or
rewritten.

Counts: 74 published topics (64 → 74), 144 resources (102 → 144), backlog 420
ideas of which 410 remain open and 10 are now published. No Wikipedia URLs
anywhere in `content_resources`; no duplicate slugs or titles.

Verification: `bunx tsgo --noEmit` clean; `bunx vitest run` — 38 tests passed;
every new URL fetched and its publisher/creator identity confirmed (YouTube
titles and channels via the platform's own oEmbed metadata); topic route renders
(HTTP 200) and the dev server logs no new errors.

Known limitations of this batch:
- Resources were checked for reachability, publisher identity and topic fit on
  20 September 2026. They were not read or watched end to end, and no human
  editorial review by Lucile has taken place yet; the verification records say
  exactly this.
- Video durations are not recorded. YouTube watch pages returned consent and
  anti-bot responses from this environment, so durations could not be read; they
  were left empty rather than invented.
- A few sources are journal landing pages that may require a subscription
  (Nature 2002 onion paper, Nature Neuroscience 2024 perspective); each is paired
  with an openly accessible source covering the same ground.
- Real email-confirmation and Google OAuth round trips remain unexercised.
