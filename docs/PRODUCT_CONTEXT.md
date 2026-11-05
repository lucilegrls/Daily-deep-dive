# Daily Deep Dive — product context

_Owner: Lucile Groleas. Consolidated 19 September 2026, in this Lovable project._

This file is the durable home for the product context that previously lived only in
chat. Sections are labelled so nothing reads as more settled than it is:
**Current requirement**, **Implemented**, **Proposal**, **Unrecovered**.

## What the app is

A scrollable curiosity and deep-learning app for people who want to understand how
things actually work. Each topic gives a mechanism, meaningful context, useful
takeaways and genuinely worthwhile further reading and watching — books, papers,
videos and articles. The brand stays *Daily Deep Dive*, but reading is **not**
limited to one topic per day.

## Current requirements

- Endless scrolling feed, envelope beside each topic; no fixed library size.
- Depth and credibility over filler; no ads, sponsored filler, invented
  testimonials, invented user counts or invented prices.
- No Wikipedia anywhere in sources, including language and mobile subdomains.
  Only http/https links.
- No visible resource counts, no use of the word "resources" around the envelope
  artwork, no "open the envelope" helper copy, no "What you should question"
  section.
- No unsupported claims of human review. What was checked, and when, is recorded
  per source and shown as recorded.
- Guest browsing stays free; accounts are optional.
- Keep the current Lovable theme: lace envelopes, clipped paper bibliography,
  gold rules, and all seven looks (Romantic default, Minimalist, Inky,
  Maximalist, Retro print, Y2K, Dark academia).
- Goal of at least 10 new topics a day, published only when qualified.
- Interests at sign-up, roughly three preferred subjects to one discovery,
  daily streaks, weekly and all-time ranking.

## Implemented (in this project, verified)

- Accounts (email and Google), profiles, interest onboarding, seven looks,
  daily streak, weekly and all-time ranking.
- Content backend: `content_topics` and `content_resources` with editorial
  status, provenance, per-source check records, and database-enforced link
  safety (http/https only, Wikipedia refused on write).
- 64 topics and their 102 sources imported from the repository library,
  keeping their original numeric ids so existing reading history and saved
  topics still match.
- Idea backlog of 188 rabbit holes imported from the repository's editorial
  topic map.
- Server-side paginated search and subject filtering across the whole library.
- Saved topics in the cloud for signed-in readers, merged once per account from
  the device list; private per-topic notes.
- A read counts only after meaningful visible time in a topic (15 seconds of
  visible dwell), deduplicated per day by the database.
- Editor's desk: review queue for drafted topics and suggested sources,
  approve/reject with a reason and a recorded verification extent, add sources,
  create topics, run history.
- Daily expansion endpoint that drafts topics from the backlog into the review
  queue and records what fell short.
- Shareable topic pages at `/topic/<slug>` with their own title and description.

## In-app AI companion (documented only)

An "Ask about this dive" panel was requested: readers ask questions about the
topic they are reading, with answers grounded in that topic and its curated
sources, citing them and admitting uncertainty. **Design only** —
`docs/AI_COMPANION_PLAN.md`. No model is connected, no reader text is sent
anywhere, no conversation storage exists, and provider approval is pending.

## Proposals / roadmap (not built)

- Spaced repetition, reading progress beyond streaks, difficulty and depth
  labels, "start here" links per topic, deeper offline/PWA support.
- Points, levels and badges on top of the existing streak and ranking.
- Monetisation: no model approved. Deliberately left open.

## Recovered 19 September

- The complete Repository Update Handoff is saved at
  `docs/REPOSITORY_UPDATE_CONTEXT_2026-09-19.md`. It holds the **220 reviewed
  topic directions** in 11 groups of 20, including the two Everyday Why sets.
  All 220 are imported into the editor-only backlog with their group and
  mechanism notes; "Everyday Why" is a permanent open-ended group. They are
  research directions, not finished topics, and none has been published as a
  placeholder. This supersedes the earlier note that the lists were lost.
- The repository's `EDITORIAL_TOPIC_MAP.md` (mirrored in `docs/reference/`)
  contributes a further 188 ideas, kept separately by provenance.

## Unrecovered material
- The recovered video-selection brief lists candidates. Those are candidates,
  not approvals.
- Nothing else is outstanding from the earlier chats.

## Subject priorities named by the owner

Body mechanisms, biology and biochemistry, glucose and fructose, vitamins, iron,
hormones, brain, cells, neuroscience and dopamine, nutrition and health, study
methods, marketing, finance, investments and bonds, law including intellectual
property, tax, business and offshore structures, politics, institutions,
geopolitics and current wars, experiments, history including the Vietnam War,
economics, culture, mathematics, arts, animals, and everyday "why?" questions.

## Onboarding (implemented)

Signed-out visitors land on a hero that explains the feed is shaped around their
curiosity, with "Build my feed" (the guided journey) and "Browse the library"
(guest browsing, never gated). The journey asks one question per screen:
subjects (minimum three, pulled live from the published taxonomy), how the feed
should feel (Focused / Balanced / Exploratory — this changes the real server-side
ordering ratio), the reading room (the seven existing looks, applied live), then a
preview of three real published topics before account creation. Existing readers
are never sent through it again; "Tune my interests" reopens the same wizard in
edit mode with Save and Cancel.

### Canonical subject catalogue (2026-09-20)

Registration no longer derives its choices from whatever happens to be
published. A backend catalogue (`interest_lanes` + `interest_lane_categories`,
public-readable, editor-writable) holds 13 stable subject lanes covering the
whole discussed scope: body/health/nutrition, brain & behaviour, fitness &
performance, learning & focus, economics & investing, business & marketing,
law/tax/offshore, politics/history/geopolitics, technology & AI, mathematics &
scientific thinking, art/culture/society, animals/nature/everyday why, and
Southeast Asia/food/travel. Each card shows a label, one line of description and
concrete example topics; lanes whose library is still being written say so
instead of pretending content exists.

New saves store lane slugs. Readers who joined earlier keep their saved category
strings: `expand_interests` passes legacy values through unchanged, the feed
honours them, and the wizard shows the lane they belong to without rewriting
anything until the reader saves.
