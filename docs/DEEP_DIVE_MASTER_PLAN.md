# Daily Deep Dive — current master plan

Updated 28 September 2026. This plan guides the existing Lovable project. Lucile's direct instructions always take precedence over this file, especially decisions about design, publication, and content. Update the plan when she changes direction.

## Goal now

Make the existing 330-topic public library accurate, rich in worthwhile learning material, and dependable in everyday use. The current priority is the quality and breadth of the bibliography and the correctness of topic text. Do not spend the next build phases on a visual redesign. Keep the seven themes, their gateway objects, the Romantic lace sheet, the present card interactions, and the scrollbar treatment.

“Abundant” means several complementary, genuinely useful resources when the topic supports them: primary evidence, rigorous synthesis, accessible explanation, a strong educational video, books, reports, datasets, or specialist material as appropriate. A working editorial target is 5–10 useful, nonredundant resources per mature topic, with no fixed minimum that invites filler. Quality and exact topic fit win over hitting a number. Explain what each resource contributes and offer a sensible first place to start.

## Verified starting point

- 330 topics are published across 23 subjects. The latest owner-authorized import added 256 unique topics while preserving the prior 74. The new entries have title-based short orientations and no invented citations. Keep them published as Lucile explicitly instructed; do not silently revert or hide them.
- The database has 144 resource rows in total. Exactly 256 published topics have no approved resource. Exactly 319 have no approved video; the 19 approved video rows are spread across 11 topics. The source-link-check table has no check records. Treat these figures as a starting snapshot and recompute them before each batch.
- The feed, search, subject filters, saved view, continuous loading, onboarding, seven themed gateways, topic sheet, account, private notes, editor desk, suggestions, ranking page, and installable manifest already exist. Improve these only when needed to support credible content and real use. Do not rebuild them.
- No topic image data model or approved topic imagery has been integrated. Exact-topic images remain an owner requirement, but the immediate sequence is resource and factual quality first. No category image or repeated artwork may be presented as a finished topic image.
- No topic-translation rows exist. Keep English as the honest fallback.

## 1. Audit topic accuracy before enriching it

Inventory every published topic by ID, slug, source-code mapping, category, text, verified-source count, video count, last check date, and editorial status. Preserve the 283 imported source-code mappings and the original 74 topics. Flag title/context/takeaway claims that are broad, dated, jurisdiction-specific, medical, legal, financial, controversial, or unsupported. Use sources actually read or reviewed to correct those claims; record a change note. Do not turn a short orientation into invented detailed facts.

Prioritize the 256 topics with no approved resources, then improve the 74 older topics where their bibliography is thin or outdated. Work in reviewable batches of about 10, ordered by reader visibility, owner priorities, and factual risk. Batches are an editorial workflow, never a limit on what readers may browse.

Until a topic has checked sources, keep the honest “Bibliography in preparation” notice. A published topic, a source-linked topic, and an editorially verified topic are different states. Never describe metadata-only link checks as full reading or human review. Do not automatically unpublish existing topics because an older plan once required sources before publication; the owner explicitly overrode that rule for the latest import.

## 2. Build substantial, traceable bibliographies

For each topic, identify the precise question or mechanism and assemble complementary sources rather than repeated explanations of the same fact. Prefer primary documents and original research, systematic or authoritative syntheses, institutions and specialist works, then strong explainers. Use books, papers, articles, reports, datasets, tools, and video when they improve understanding. No Wikipedia, content farms, superficial title matches, link padding, pirated PDFs, or unauthorized uploads.

For every candidate record its exact URL, title, author/creator, publisher, publication/update date when known, access type, the part of the topic it supports, why it was selected, learning level, verification method and extent, date checked, limitations, and approval status. Check the landing page and enough substance to establish exact topic fit; inspect full content when accessible. If only an abstract or metadata was available, say so. Distinguish evidence from inference and note meaningful disagreements. High-stakes or fast-changing topics need sources current for the claim, with jurisdiction and “as of” dates where relevant.

Provide an editorial “Start here” choice when there is a genuinely strong introduction, then optional Foundation, Go deeper, and Specialist groupings. Do not force every type or level onto every topic. Display a short reader-facing selection reason without exposing private editorial notes. Keep the existing themed sheet and bibliographic layout; add hierarchy only where it improves clarity.

## 3. Verify educational videos properly

Seek at least one strong video per topic when one actually qualifies; an owner-reviewed “no suitable video yet” exception is better than a weak match. A video should teach the topic's mechanism, causal chain, historical sequence, or legal/economic process. Check the creator, coverage, current accuracy, description, and traceable supporting sources. A title match, popularity, production polish, or an unsupported claim to have “done research” is insufficient. Do not invent video IDs, durations, sources, or viewing history.

Track candidate, sources-checked, approved, rejected, and needs-reverification states separately. Show only approved videos. Audit the existing 19 approved rows to the same standard.

## 4. Make review repeatable and measurable

Extend the existing editor desk with a queue showing source-free topics, thin bibliographies, missing or stale videos, broken links, and claims needing a factual check. Preserve privileged audit history. Add an on-demand source-link checker under the project's existing egress/security constraints; the current zero-check table is not evidence that links work. Link availability is one signal, never a substitute for content review. Record redirects, failures, replacement decisions, and recheck dates without silently deleting links.

For each batch report exact before/after counts: topics with zero approved sources, topics with several complementary approved sources, resource rows by type, video coverage, broken/stale links, factual corrections, and remaining exceptions. Include IDs or slugs completed, verification depth, test results, and what was actually examined. Make imports and migrations idempotent; preserve saves, reads, notes, profiles, suggestions, slugs, and the existing `ressources` compatibility key until its dependents are changed together.

## 5. Public-use reliability and trust

Check real reader journeys on desktop and mobile: discover and search all published topics, open by gateway/title/keyboard, read and follow bibliography links, save independently, close and reopen a topic, and recover from loading errors. Preserve scroll by wheel, touch, trackpad, arrows, Page Up/Down, Home/End, and keyboard navigation while native scrollbars remain visually hidden. Check source readability in each theme without changing theme art direction. Verify preview and live theme persistence so a selected Maximalist look continues to show its phone and matching theme label.

Audit current public language against the evidence actually stored. Do not claim every topic or source is fully reviewed. Add or verify Privacy, Terms, Copyright/Corrections, and Contact pages, account export/deletion, secure storage policies, backup and restore, and a release rollback or forward-fix path. The site is already public, so these are active trust tasks. Verify EN/FR/ES/ZH/AR interface coverage and RTL; leave untranslated topic research in its real language. Keep reader notes private and the existing leaderboard limited to intended public data. Do not activate the in-app AI companion or a scheduled AI publication workflow during this resource phase.

## Later work, after resource quality is under control

Complete the previously requested distinct image for every exact topic with an individual visual brief, alt text, `image_subject_match_reason`, provenance, rights review, and no generic/reused category image. Integrate it around the existing gateway without replacing the theme object. Additional reading-history, completion, revisit, localization, SEO, and offline work can follow evidence of a concrete reader need. A public-name change from Daily Deep Dive to Deep Dive remains a separate branding decision; do not bundle it with bibliography work.

## Execution and release rules

Start with a live inventory and the first batch of source-free topics. Research, verify, write accurate metadata, test, and repeat automatically within the approved scope; do not stop at another speculative redesign plan. Give Lucile truthful counts and explicit exceptions after each batch. Keep all 330 existing topics and theme assets. Do not publish a new site build without a direct release instruction. Never rewrite the project's published git history.

## Standing rules that carry over (unchanged)

These earlier commitments remain in force and are not superseded by the resource-first focus:

- Keep the seven themes and their gateway objects, including the Maximalist phone and the Romantic envelope. Lace belongs to the Romantic theme only; each theme has its own gateway object.
- Keep the existing theme system and overall art direction. No generic SaaS gradients or redesign; no visible resource numbers or the words “resources” / “open the envelope” on gateway artwork.
- Keep all published topics in the main discovery feed; onboarding only tunes ordering and must not hide topics.
- Keep the reader-facing AI companion and any scheduled automatic AI publication workflow paused. Owner-directed AI assistance for drafting or creating topic images is allowed, but it must never fabricate facts or sources, must never mark work as reviewed or approved, and must never publish automatically.
- No Wikipedia links; no fabricated studies, authors, dates, quotes, or URLs. Do not host or link to unauthorized copies of copyrighted works.
- Never delete existing topics, resources, reads, saves, suggestions, or user profiles. Run migrations additively and idempotently.
- Human review stands behind anything described as reviewed or approved; metadata-only checks are never described as full reading.
- Do not publish a new site build without a direct release instruction from Lucile.
