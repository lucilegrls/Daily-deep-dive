# Topic-specific imagery foundation and first verified batch

## Scope
- Add a dedicated visual-editorial record for every topic, with the requested structured brief, match rationale, image location, provenance, and review status.
- Keep images private from readers until their record is explicitly approved; public feed queries expose only approved image fields.
- Populate a complete, topic-specific draft brief for all 330 published topics from each topic’s exact title and existing context, without claiming an image exists.
- Generate, inspect, store, and approve a concrete first batch covering the 12 topics in the initial feed. Each image will be unique and subject-specific; failed or ambiguous generations remain unapproved.
- Integrate approved imagery into the most prominent part of each feed row while keeping the existing theme gateway object clickable and the title readable. Topics without an approved image retain the current layout without a category fallback.
- Carry approved image data through the main feed, saved topics, and topic detail paths.

## Safety and editorial rules
- No category defaults, reused URLs, title-as-image substitutes, or fabricated completion records.
- Enforce one visual record per topic and one approved image location per library entry.
- Store provenance and review notes; only approved records can appear publicly.
- Preserve all seven themes, existing gateway behavior, save independence, keyboard access, translations, and backend content.
- Do not publish the site.

## Verification
- Recompute exact counts for published topics, complete briefs, approved unique images, missing/failed images, and duplicate image URLs.
- Check real feed cards in Romantic and Maximalist at desktop and mobile widths.
- Verify mouse and keyboard opening, saved-topic rendering, image alt text, graceful no-image behavior, TypeScript, tests, build, and database security checks.

## Technical details
- Use an additive `topic_visuals` table with strict grants/RLS and a public projection function or approved-only read policy.
- Extend `feed_topics` overloads and direct topic selects with approved image URL/alt fields while retaining both existing function signatures.
- Store generated web images in a public read-only media bucket; writes remain privileged/editorial only.
- Keep generation outside the running app, so there is no reader-triggered AI call or recurring AI feature cost.

## Completion boundary
The database and UI will support all 330 topics, and all 330 will receive complete draft briefs. Image approval will be reported honestly: this implementation includes the first verified 12-image batch, not fabricated coverage for the remaining topics.
