# Complete French public-card display update

## Scope and coverage

The read-only inventory contains **1,300 public sources**, **1,253 distinct URLs** and **331 published topics**. Existing French topic titles, summaries and EN/FR interface controls are preserved.

| Field | Original distinct strings | Final mapped strings | Remaining useful-text gaps |
| --- | ---: | ---: | ---: |
| Source titles | 1,256 | 1,256 | 0 |
| Cleaned descriptions | 1,033 | 1,033 | 0 |
| Limitations | 141 | 135 | 0 |
| Publication strings | 496 | 496 | 0 |
| Takeaways | 1,022 | 1,022 | 0 |

Six limitation entries contain only internal appraisal/inspection notes and therefore have no public display text. Their internal originals and verification records are not changed. Names of journals, organizations, people, identifiers and ISO YouTube dates remain canonical where translation is not appropriate. Supplied original recording dates and genuine scientific, medical, jurisdictional, access and prepublication caveats are retained.

## Independently inspectable delivery

- `src/data/french-public-copy/snapshot.json`: safe-public inventory with source IDs, URLs, associations and display-only cleaned English text.
- Numbered `titles-*`, `descriptions-*`, `limitations-*`, `publications-*`, `takeaways-*` JSON files: manually authored saved translation checkpoints.
- `translations.json`: deterministic exact-English/French pairs used by the reader. This is the final display map, including the last cleanup pass.
- `guards.json`: canonical ID/URL/title/field and ID/slug/title/takeaway guards; no private research notes or evidence.
- `src/lib/french-public-copy.ts`: the shared display resolver. Changed or unknown fields and identities fall back to their current English text; no fetched object is mutated.
- `src/components/TopicSheet.tsx` and `src/components/viewer/ResourceViewer.tsx`: use the shared resolver at reader display boundaries. Native original-title tooltips, original source credits, links, playback and PDF behavior remain intact.
- `src/lib/reader-copy.ts`: targeted display-only removal of residual internal eligibility-window, inspection and appraisal notes. It does not change source eligibility or scientific content.

Translating the card title or description does **not** translate the external paper, video, transcript, source body or PDF. The original work and its real language remain unchanged. No runtime translation model, network translation service, provider, subagent, database write, migration, cron or publication was used.

## Validation

- Full suite: `bunx vitest run`; 226 tests across 19 files.
- New exhaustive tests check every source title/description/limitation/publication and all takeaways against the inventory, including unchanged English, unknown/changed identities, source text and URL fallbacks, and preservation of canonical objects.
- Targeted cleanup regressions preserve scientific replication discussions, real recording dates, access caveats and research-subject uses of candidate generation and ownership verification.
- Browser checks at 1280×1800 and 390×844: topics 2, 6 (Scaling Laws), 166 and 331; French source titles/descriptions/takeaways, original-title tooltips, English restoration, then French restoration.
- Exact arXiv paper `2001.08361`: 30-page PDF rendered with visible first-page ink (20,251 dark pixels desktop; 6,176 mobile), page 2 navigation and canvas removal on close.
- Video: no player iframe before Play, one afterward, none after close. Actual playback remains controlled by YouTube and is not claimed as verified.
- No browser page errors and no horizontal document overflow in the tested viewports.
- Preview compilation checked through the harness logs. No manual build or typecheck was run.

## Remaining scope

**No untranslated useful inventory strings remain in this snapshot.** New or edited catalogue copy intentionally uses the original until a matching reviewed translation is added. No catalogue approval, rights decision, source content or saved private note was altered. The preview remains unpublished for Lucile's independent review.