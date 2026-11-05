# In-app source display verification

## Delivered changes

- `src/lib/viewer-media.ts`: one pure resolver for all displayed sources, strict HTTPS/provider identity validation, canonical YouTube/Vimeo IDs, official click-to-play player inference despite imported `link_only` defaults, direct publisher PDF and valid arXiv PDF resolution, Google Books and Spotify preview mappings.
- `src/components/viewer/ResourceViewer.tsx`: lazy in-app video/file/provider display, validated thumbnails, explicit unsupported/blocked explanations, original-source links, user-triggered blocked-player/file fallback, focus and playback lifecycle handling.
- `src/lib/viewer-media.test.ts`: 30 media tests including imported video defaults, malformed/malicious addresses, rights restrictions, blocked/broken sources, remote files versus hosted content, valid paper mappings and unsupported providers.
- `AGENTS.md`: documents the shared resolver and separation between browser display, hosting rights and editorial approval.
- `roadmap.md`: records completed verification and real provider limitations.

## Eligibility and preservation

No source rows, rights, review/verification metadata, accounts, theme designs, scheduled jobs or research scope were changed. Nothing was published.

`getTopic` in `src/lib/content.functions.ts` and `getTopicViewer` in `src/lib/viewer.functions.ts` both require published topics and approved sources, then apply `isSafeSourceUrl`. Topic Sheet links for every bibliography group already enter the individual overlay. No additional mode-based bibliography filter was needed, and adding one would incorrectly hide fallback sources. Internal stored text/files retain owned/licensed/public-domain rights gating. Explicit blocked/broken or link-only rights override inference. Browser-direct publisher PDF display does not grant permission to copy or host it.

## Read-only public catalogue audit

The actual anonymous-visible approved catalogue contains **1,300 sources**:

| Type | Official video player | Direct publisher PDF | Original-link fallback |
|---|---:|---:|---:|
| Videos | 357 | 0 | 96 |
| Papers | 0 | 18 | 294 |
| Articles | 0 | 55 | 462 |
| Books | 0 | 5 | 13 |
| Total | **357** | **78** | **865** |

These are resolver capabilities, not proof that every remote item is available. There are no current Spotify/Google Books preview matches in this audited catalogue. New matching approved sources use the same resolver without bulk metadata updates.

## Actual verification

- Full test suite: **13 files passed, 184 tests passed**; media resolver: **30 passed**.
- Harness typecheck/build: latest entry `build OK` at `2026-10-20T11:57:52Z`, after resolving strict optional-property type errors. No separate manual build/typecheck was run.
- Real desktop (1280×1800) and mobile (390×844) preview flows: opened the existing themed sheet and an imported YouTube source, verified no iframe before Play, official privacy-enhanced player after Play, one iframe only, next/previous unmount and reset, Escape and close return focus to the exact bibliography link, no horizontal mobile page overflow, and original-link fallback for unsupported articles.
- Real publisher PDF: IMF inflation PDF entered its overlay; no iframe before the reader requested display; direct publisher URL after click; blocked-file fallback removed the iframe and retained the original link.
- No app `pageerror` events in the final browser run.

## Limitations observed, not bypassed

The tested YouTube player displayed “Sign in to confirm you're not a bot” in the sandbox. This is an actual provider challenge, not verified playable content. The tested IMF PDF remained blank in the embedded mobile Chromium view. The visible fallback controls worked in both cases. Publisher/browser restrictions, removed videos, sign-in requirements, paywalls, CSP and frame-denial cannot safely be bypassed. Unsupported articles/book landing pages retain attribution, available description, an honest explanation and the original-source link inside the overlay; their full text is not falsely represented as embedded.

## Preview

https://id-preview--2a049fca-1458-49dc-a4a8-202285b17bdd.lovable.app

The public site has not received these unpublished code changes.

## PDF regression correction — 20 October 2026

The previous native PDF iframe mount was not evidence of document rendering. Its sandbox can disable native PDF plugins; it has been removed from the remote-PDF path rather than loosening sandbox permissions for arbitrary publisher content.

- Exact catalogue example: topic 6, `scaling-laws-patterns-and-limits`, “Scaling Laws for Neural Language Models”, `https://arxiv.org/abs/2001.08361`, resolving to `https://arxiv.org/pdf/2001.08361`.
- Browser fetches from both the live origin and localhost returned HTTP 200, `application/pdf`, 2,493,004 bytes and `%PDF-1.5`; arXiv supplies `Access-Control-Allow-Origin: *`. CORS is not the blocker for this paper.
- The modern PDF.js 6 build additionally failed during actual page rendering with `TypeError: this[#methodPromises].getOrInsertComputed is not a function`. The bundled legacy compatibility build and matching legacy worker rendered successfully. No publisher proxy, uploads, copied files or rights/status changes were made.
- Remote PDFs now load PDF.js only after the reader clicks, fetch directly in the browser under CORS, render one canvas page at a time, fit the mobile viewport, and keep original links. Loading and rendering each have a 20-second limit; failure removes the reader and shows an explicit error. Remote reads do not write account/device progress; existing stored-file rights gating and persistence remain intact.
- Actual final preview checks (Chromium desktop 1280×1800 and mobile 390×844): **30 pages**, first-page canvas **612×792 / 314×407**, **16,815 / 4,702 dark pixels**. Viewed screenshots show the real paper title, authors and abstract, not a blank frame. Page 2, previous page, zoom, close cleanup (zero canvases) and focus return to the exact bibliography link passed. No app page errors.
- Exact IMF example: topic 5, `https://www.imf.org/-/media/files/publications/fandd/back-to-basics/oner-inflation.pdf`. HTTP 200 PDF, but **no Access-Control-Allow-Origin**; real browser requests from both live and localhost were denied by CORS. Desktop/mobile preview now show the explicit failure and original link, with zero blank canvas/iframe. Native embedding is not used because its content cannot reliably be verified under the existing sandbox. No restrictions were bypassed.
- Tests: **14 files / 188 tests passed**, including 34 PDF bounds/media tests. Harness reports `build OK`. Changes are preview-only, not live; no publication. Device emulation is not a physical iOS/Safari test.
- Changed files: `src/components/viewer/PdfViewer.tsx`, `src/components/viewer/ResourceViewer.tsx`, `src/lib/pdf-display.ts`, `src/lib/pdf-display.test.ts`, `AGENTS.md`, `roadmap.md`, this document. Git commits are managed by Lovable; the pre-change base was `81db58c`, and no manual commit was created.