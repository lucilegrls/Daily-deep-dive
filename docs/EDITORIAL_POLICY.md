# Daily Deep Dive — editorial policy

_Consolidated 19 September 2026. Reference copies of the original repository
documents are in `docs/reference/` (`SOURCE_POLICY.md`, `SOURCE_AUDIT.md`,
`EDITORIAL_TOPIC_MAP.md`)._

## Sources

- Never Wikipedia, in any language, mobile or mirror form. Enforced in the
  database (`public.is_safe_source_url`), on import, and at render time.
- Only http/https links.
- A source must be comprehensive for its role, credible, substantive and worth
  the reader's time. Format prestige decides nothing on its own.
- Prefer primary sources, peer-reviewed work, institutions, established experts
  and rigorous specialist journalism. Health, legal, medical and current-affairs
  claims need appropriate sources, dates and jurisdiction.
- A working link never proves the claims or a full editorial review. The stored
  check record says what was actually checked: `watched/read in full`,
  `partly reviewed`, or `link and identity checked only`. Never label a
  metadata-only check as a full review.

## Topics

- A raw label is not a topic. Refine it into a question that gives a mental
  model, exposes uncertainty and has enough credible evidence behind it.
- Unresolved entries stay drafts. Drafts, candidates, rejected items and
  editorial notes are never exposed to readers.
- No duplicate topics: slugs are unique, and imports are idempotent.

## Videos

Every topic should eventually carry at least one genuinely educational,
topic-specific video. Taste, in order of preference:

1. Mechanistic visual explainers (reference: Dr Matt & Dr Mike, *Iron
   Physiology | Diet, Absorption, Storage, and Function*).
2. Accessible specialists with real expertise.
3. Substantive science or documentary storytelling.
4. Rigorous long-form expert discussion.
5. Lectures, when a lecture teaches it best.

Diagrams, pathways, causal chains, worked examples and meaningful narrative
matter. Length and institutional prestige do not decide quality. Country is not
a filter, and no single channel or country should dominate.

Excluded: music, non-educational entertainment and lifestyle content, Shorts,
empty clickbait, listicles, and anything researched from Wikipedia.

For each video the backend records: title, creator, exact URL, duration,
difficulty, format, concepts, credibility notes, selection reason, status
(candidate / approved / rejected), rejection reason, last check and verification
extent. YouTube ids and URLs are never invented.

**Current coverage: 1 topic of 64 has videos (2 approved).** The rest is
outstanding work, not a finished job.

## Daily expansion

The target is at least 10 new topics a day. The run drafts from the idea
backlog into the review queue, records duplicates, refusals and any shortfall,
and never publishes on its own. Quotas are never met by publishing unverified
output.
