# French summaries and reader commands — 22 October 2026

## Delivered; overall request is incomplete

All **331 supplied reviewed French summaries** are integrated, exactly and only when ID, supplied slug, canonical title and context match. The uploaded JSON is byte-identical to the bundled file (SHA256 `fe082e97c63590f05069d621569d610db9620c8c8591cae3e1b72db7a6df045f`). The complete current published inventory matches all 331 supplied rows. Unknown or edited topics fall back to their cleaned canonical English. French abbreviations and dates in the reviewed summaries are not passed through the English prose parser.

The helper is wired into feed/saved cards, both existing sheet compositions, topic details and onboarding previews. Existing French topic titles remain unchanged. Bibliography group labels, Start here, source/PDF controls, loading/error messages and concept-tool commands have static French interface copy. No translation service runs in the app.

## Read-only authoritative inventory

The complete catalogue was read using database read tools, not the old bundled seed. Public reader eligibility remains approved source + published topic + existing safe-source-URL application filter. No eligibility or permission changes were made.

- Published topics: **331**.
- Public reader-visible approved resource rows: **1,300**, with **1,253 distinct URLs**.
- Other catalogue rows: **2 rejected**, excluded from public coverage.
- Distinct original formal source titles: **1,256**.
- Distinct nonempty cleaned source descriptions: **1,033**.
- Distinct nonempty cleaned scientific/access/other limitation strings: **141**.
- Distinct nonempty cleaned publication strings: **496** (many are dates or brands, not prose to translate).
- Visible original takeaway entries: **1,022**, also **1,022 distinct nonempty cleaned strings**.

There was **no inventory/export limit or missing batch**. No database writes, migrations, source approvals, research jobs, scheduling or publication occurred.

## Exact remaining gap and quality blocker

The 1,022 takeaway entries and all public source prose/formal titles/publication phrases **are not translated**. They continue to show original cleaned English, with existing names, dates, durations, URLs and technical identifiers untouched. Some older public workflow disclaimers still remain; the existing reader-copy cleanup was not expanded in this pass.

An offline, build-time-only free translation model was evaluated on the complete deduplicated prose inventory. It mistranslated technical meaning (non-heme iron as hemorrhagic iron; power-law relationships as relationships between power and law), changed or dropped identifiers and omitted qualifications. Those outputs and empty placeholder mappings were **discarded, not bundled or displayed**. No source texts were sent to a network translation service; no app dependency was added for translation. This is a translation-quality blocker, not an authentication/export/tool-access blocker. A faithful complete translation corpus remains necessary; no exhaustive source-translation coverage is claimed.

External PDF text, video/audio, publisher pages, notes and research evidence are unchanged. Original source language is not represented as French. Source titles remain original (including native title tooltips), and unsupported sources stay native direct links.

## Verification actually performed

- Full suite: **218 tests passed in 18 files**. Four new tests cover all 331 summaries, exact supplied French, canonical English preservation, source mismatch fallback, and topic 331.
- Automatic harness typecheck/build: **build OK** after removing the incomplete mappings. No separate manual build/typecheck was run.
- Real public reader browser, **1280×1800** and **390×844**:
  - Initial feed summaries match supplied French; detail/sheet summaries for IDs **6, 166, 331** match exactly, with English/French switching.
  - Exact Scaling Laws arXiv PDF renders **30 pages** with visible first-page ink (20,251 dark pixels desktop; 6,176 mobile), page navigation and canvas teardown.
  - YouTube facade mounts no iframe before Play, one official iframe after Play, and unloads it on close. Actual video playback was not established.
  - MIT OCW unsupported source opens directly at its original external URL, without an intermediary source view.
  - No runtime page errors or horizontal document overflow in checked journeys.
- Desktop topic 331 and mobile PDF screenshots inspected: existing Romantic sheet composition and actual PDF page rendering preserved; source descriptions remain English, demonstrating the remaining gap.

These were public reader journeys; account-private data flows were not retested. The non-Romantic summary branch and onboarding preview are wired to the same tested helper but were not independently exercised interactively. English PDF controls, modified-click behavior and every theme were not separately retested in this pass. Media resolver and PDF rendering logic were not modified.

## Changed application files

- `src/data/french-topic-summaries.json`
- `src/lib/topic-copy.ts`, `src/lib/topic-copy.test.ts`, `src/lib/reader-ui.ts`
- `src/components/TopicRow.tsx`, `TopicSheet.tsx`, `OnboardingWizard.tsx`
- `src/routes/topic.$slug.tsx`
- `src/components/viewer/ResourceViewer.tsx`, `PdfViewer.tsx`, `ConceptToolbar.tsx`
- `AGENTS.md`, `roadmap.md`, this report, project language preference memory.

`reader-copy.ts` is unchanged in final behavior; incomplete source/takeaway bundles and source-copy helper were removed. No paid/runtime services, subagents, backend changes or publication.

Preview: https://id-preview--2a049fca-1458-49dc-a4a8-202285b17bdd.lovable.app

**Unpublished partial delivery for independent review; not a completed all-source French release.**