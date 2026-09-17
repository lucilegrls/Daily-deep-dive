# Daily Deep Dive

A calm, tactile collection of curated ideas. Scroll through topics, open each envelope to explore its resources, search by question or subject, and save topics for later.

## Run locally

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000`. Serve over HTTPS for installation and offline support. The relative manifest paths support GitHub Pages and other static hosts.

## Collection behavior

Four topics render initially, with more appended near the bottom. The Explore more button provides a keyboard-accessible fallback. Topics do not change at midnight or repeat endlessly. The end message reflects the current finite library. Surprise me scrolls to a topic matching the current filters. Saved topic IDs persist on this device; there is no account or cloud sync.

## Content policy

See [project context and roadmap](Daily_Deep_Dive_Project_Context.md). Every resource must be comprehensive for its scope, credible, substantive, and only as long as necessary. No Wikipedia, filler, SEO content farms, or resource quotas. Existing Wikipedia entries have been removed, and rendering rejects Wikipedia domains. URL filtering cannot certify source quality; editorial review is required.

Resources use the existing `ressources` JSON property and `books`, `papers`, `videos`, `articles` groups. Optional `tags` participate in search. Use unique stable IDs, a category, a title, context, takeaways, and at least one valid resource. Resource descriptions and book hooks appear in the sheet. Search links are explicitly labeled and must be replaced with verified direct destinations where possible before commercial release.

## Artwork

Assets live in `icon/`. `envelope.png` and `envelope-paper.png` are the closed/open envelope images. Replace the three `paper-*.png` assets with matched, transparent PNGs retaining the lace and clip silhouette. CSS keeps the outer sheet transparent and lightly washes the caps; opaque pixels embedded in the artwork still require asset replacement. Keep readable paper interiors and aligned slice widths. The resource-paper CSS variables provide a central replacement point.

## Offline and updates

The service worker caches the full local shell and artwork, uses network-first requests, and falls back to cached files offline. Remote resources and fonts are not bundled. Change `CACHE` in `sw.js` after releases. Failed asset requests do not return HTML as an image or JSON response.

## Commercial roadmap

Preserve the authored editorial identity as new images arrive. Grow the curated library, verify content and links, then add related topics, notes, and optional review. Accounts, cloud sync, payments, licensing, privacy documentation, and app-store distribution are future work. This repository is the product foundation, not a completed commercial launch.

## Validation

Run `node --check script.js` and `node --check sw.js`. Serve the app and check scrolling, topic envelopes, search, subjects, saving, modal keyboard access, narrow screens, dark mode, and offline reload. All precached paths must exist.
