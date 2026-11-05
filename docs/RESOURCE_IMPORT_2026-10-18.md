# Candidate import — 18 October 2026

## Verified result

- Before: 642 sources, 331 topics.
- Added: 657 candidates — 350 readings and 307 videos.
- After: 1,299 sources, 331 topics; 642 prior source rows remain.
- Duplicate/skipped records in the supplied manifest: 0. Rejected records: 0.
- All 657 additions have candidate review status, unreviewed topic fit and credibility, needs_review=true, unchecked link status, unknown rights and unverified embedding.
- Full supplied records preserved in 657 editor-private metadata rows. Public verification explicitly states that no page, rights or embedding verification was performed.
- 307 topics have a candidate video; 327 have at least two non-rejected readings; 303 meet both conditions. Candidate coverage is not approved coverage.
- No source updates or deletions, topic remapping, AI calls, external page probing or site publication were performed.

## Spot checks

| Topic ID | Topic | Imported | Total sources |
| --- | --- | --- | --- |
| 1 | Iron: Why intake and absorption differ | 0 | 6 |
| 166 | The birthday paradox | 0 | 5 |
| 331 | Growing the Future: How Living Bacteria Could Revolutionize Technology | 4 | 5 |

The supplied manifest contains no additions for topics 1 or 166. Four additions for topic 331 are all candidates:

- **Engineered living biomaterials** — https://www.nature.com/articles/s41578-021-00350-8
- **Kombucha Bacterial Cellulose: A Promising Biopolymer for Advanced Food and Nonfood Applications** — https://pmc.ncbi.nlm.nih.gov/articles/PMC11898560
- **Kombucha electronics: electronic circuits on kombucha mats** — https://www.nature.com/articles/s41598-023-36244-8
- **Synthetic Biology: Programming Living Bacteria - Christopher Voigt** — https://www.youtube.com/watch?v=lNttxYdGHs4

## Recovery checks

The authenticated editor batch operation was executed using a managed session, with no human sign-in requested. A simulated failure on the second request stopped after 20 confirmed records. Reloading and selecting the same file restored the checkpoint, then completed all 657 records. A separate replay of the first 20 records added none and reported 20 duplicates. 41 focused import/source-safety tests passed; latest preview build succeeded.

## Limits

JSON manifests or arrays, at most 20 MB and 20,000 records; sequential batches up to 20 records and 256 KB. Failed writes are not automatically retried. Checkpoints expire after seven days and contain progress/errors only, not the source file. Re-select the original file to resume; if no checkpoint exists, replay remains insert-only. Link/content credibility verification still requires editorial review; the unsafe automatic link checker remains disabled.