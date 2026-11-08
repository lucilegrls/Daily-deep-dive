# English/French reader titles — 22 October 2026

## Result and coverage

- Only English and French are supported runtime languages and selectable choices.
- Reconciled the **actual complete published database inventory**, not the legacy topic JSON: **331 published topics**, IDs **1–331**.
- **331/331** uploaded rows match live ID, slug, category and English title exactly; no mismatches, duplicate IDs or duplicate slugs.
- Reviewed French titles now render through one display-only helper on feed and saved cards, themed gateway accessible names, both Topic Sheet compositions, related-topic buttons, preference preview cards, concept-topic results, source-overlay topic headings and topic-detail headings/document titles.
- English titles remain canonical. Summaries, takeaways, source names, research/evidence, rights and eligibility remain unchanged. No database writes, permission changes, resource jobs, scheduler changes or publication.
- Unknown new IDs or mismatched slugs fall back to their supplied title.
- Retired stored preferences migrate to a supported browser language (English when none matches), persist safely, and never leave the document in RTL. Archived ES/ZH/AR wording remains in source data but is not selectable or accepted as a runtime locale.
- Language switching changes display only: it does not change feed query keys, search, sorting, pagination or fetched objects. Search still uses the original catalogue wording; French-title search was not added.
- Topic-page server-rendered metadata remains canonical English before the browser reads its saved locale; the visible document title and Open Graph title update to the selected title after hydration.

## Changed files

Application:

- `src/data/french-topic-titles.json` — supplied reviewed source-controlled mapping.
- `src/lib/topic-titles.ts` — shared display resolver with ID/slug validation and fallback.
- `src/lib/i18n.tsx` — EN/FR runtime choices, safe preference migration, LTR.
- `src/lib/translations.ts` — supported dictionaries and directly misleading language-choice copy.
- `src/lib/content-labels.ts` — preserve retired data with consistent typing; updated title comment and safe gateway fallbacks.
- `src/routes/__root.tsx` — early document language accepts only supported codes and never enables RTL.
- `src/routes/topic.$slug.tsx` — translated heading/document title.
- `src/components/TopicRow.tsx` — shared titles for feed/saved cards and gateways.
- `src/components/TopicGateway.tsx` — localized open-topic accessible name.
- `src/components/TopicSheet.tsx` — headings and related-topic titles in both existing compositions.
- `src/components/OnboardingWizard.tsx` — reviewed titles in the existing preview.
- `src/components/viewer/ResourceViewer.tsx` — topic heading only; source names unchanged.
- `src/components/viewer/ConceptToolbar.tsx` — related-topic result titles only.

Tests and documentation:

- `src/lib/i18n.test.ts` — 9 tests: exactly EN/FR, retired/invalid preferences, browser detection, first visit, explicit preferences and LTR.
- `src/lib/topic-titles.test.ts` — 5 tests: complete 331-ID/slug coverage, all French/English resolutions and original-field preservation, exact representative titles, new/mismatched fallback and switching.
- `src/lib/write-outcome.test.ts` — existing recovery regression now uses supported French rather than retired Arabic.
- `AGENTS.md`, `roadmap.md`, this report; project memory records the user's scope.

## Checks actually run

- Full suite: `bunx vitest run` — **214 tests passed in 17 files**.
- Automatic Lovable typecheck/build: latest entries **build OK** (07:00:21 and 07:00:46 UTC). No separate manual build/typecheck was run, in accordance with the project's automatic-check workflow.
- Real preview browser with the requesting user's own account, desktop **1280×1800** and mobile **390×844**:
  - French first-visit selector presents exactly English/French and confirms French.
  - All 12 initial feed headings and gateway accessible names match their reviewed French titles.
  - Actual account saved-list cards resolve to reviewed French titles.
  - Topic Sheet heading and three related-topic titles agree with the selected language.
  - Switching to English updates loaded cards; reload retains English.
  - A stored Arabic preference migrates to English and LTR.
  - Detail pages **6, 166 and 331** show correct French and English headings/document titles after switching.
  - Scaling Laws' supported arXiv source opens in its existing overlay: topic heading is French, original source title remains unchanged; cached sheet reopens in English after switching.
  - No horizontal page overflow in checked detail views; no runtime page errors in the main browser journey.
  - Desktop/mobile screenshots inspected: original sheet composition retained and long French heading wraps on mobile.
- Source inspection confirms the existing LanguagePicker and LanguageGate both derive their choices from `LANGUAGES`; no duplicate choice list was introduced.

The preference-preview and concept-result changes are covered by the shared resolver tests and source inspection; their complete interactive journeys were not separately exercised. PDF canvas readability was not retested in this language-only pass; PDF.js and the shared media resolver were not edited.

## Preview

https://id-preview--2a049fca-1458-49dc-a4a8-202285b17bdd.lovable.app

**Unpublished, left for Lucile's independent review.**