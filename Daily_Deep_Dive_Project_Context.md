# Daily Deep Dive — Project Context & Product Roadmap

_Last updated: 17 September 2026_

This file is intended to be uploaded to the project and used as persistent context for future work on **Daily Deep Dive**. It summarizes the current product, repository structure, design decisions, resource-quality rules, known fixes, and future product goals.

---

## 1. Project identity

**Project name:** Daily Deep Dive

**Repository:** `lucilegrls/Daily-deep-dive`

**Current concept:** A visually distinctive learning app that presents carefully curated topics with concise explanations and high-quality resources.

**Evolving concept:** Move away from a strict “one topic per day” experience toward a **continuous, scrollable discovery app** containing many deep-dive topics.

The long-term goal is to make Daily Deep Dive feel like a **personal knowledge-discovery platform**: beautiful, calm, curated, substantive, and capable of supporting long-term learning.

---

## 2. Core product philosophy

The app should prioritize **depth over quantity** and **curation over generic aggregation**.

A topic should help the user genuinely understand something, not merely skim it.

### Resource-selection rule

Every resource added to a topic should satisfy the following criteria:

- **Comprehensive for the topic’s scope**
- **From a credible source who knows what they are talking about**
- **No fluff or surface-level skimming**
- **Length should be whatever is necessary**
  - not artificially short
  - not unnecessarily long
- **Wikipedia must never be used as a resource**

This applies to:

- Books
- Academic papers / research
- Videos
- Articles
- Courses
- Tools
- Other educational sources that may be added later

### Source preferences

When possible, prefer:

1. Primary sources
2. Peer-reviewed research
3. Official institutions
4. Major academic references
5. Well-established expert authors
6. High-quality long-form journalism or specialist publications

Avoid:

- Wikipedia
- SEO content farms
- Generic listicles
- Surface-level explainers when a stronger source exists
- Repetitive resources that add no new value
- Sources included merely to increase the resource count

A topic does **not** need a fixed number of resources. Quality matters more than quantity.

---

## 3. Current repository structure

The repository currently contains:

- `README.md`
- `index.html`
- `manifest.webmanifest`
- `style.css`
- `sw.js`
- `topics.json`
- `script.js`

### Asset folder

The asset folder is:

`icon/`

Important files include:

- `article_icon.png`
- `book_icon.png`
- `envelope-paper (1).png`
- `envelope.png`
- `icon-192.png`
- `icon-512.png`
- `paper-bottom.png`
- `paper-middle.png`
- `paper-top.png`
- `video_icon.png`

Important note:

The folder name is **`icon/`**, not `icons/`.

---

## 4. Current topic data model

`topics.json` contains a top-level structure like:

```json
{
  "topics": [
    {
      "id": "...",
      "title": "...",
      "context": "...",
      "takeaways": [],
      "ressources": {
        "books": [],
        "papers": [],
        "videos": [],
        "articles": []
      }
    }
  ]
}
```

Note that the existing property is spelled:

`ressources`

with the French-style double “s”.

Do not silently rename it unless all dependent code is updated at the same time.

### Current resource groups

The valid groups are:

- `books`
- `papers`
- `videos`
- `articles`

The JavaScript was previously incorrectly configured for:

- `foundations`
- `deepDives`
- `criticalPerspectives`

That mismatch caused the resource count to be `0`, which caused the envelope to be hidden.

This was fixed by updating `GROUPS` in `script.js` to use the actual keys from `topics.json`.

---

## 5. Current JavaScript resource groups

The corrected `GROUPS` configuration is:

```js
const GROUPS = [
  { key: 'books', label: 'Books', icon: '📚', meta: r => [r.author].filter(Boolean).join(' • ') },
  { key: 'papers', label: 'Papers', icon: '📄', meta: r => [r.source].filter(Boolean).join(' • ') },
  { key: 'videos', label: 'Videos', icon: '▶️', meta: r => [r.creator].filter(Boolean).join(' • ') },
  { key: 'articles', label: 'Articles', icon: '📰', meta: r => [r.publication].filter(Boolean).join(' • ') },
];
```

The envelope began working correctly after deploying this corrected version and clearing the old cached app version.

---

## 6. Service worker / caching issue already encountered

A previous bug persisted after code changes because the browser/service worker was serving an older cached version.

The working fix was:

1. Open browser developer tools
2. Go to **Application**
3. Go to **Service Workers**
4. Unregister the service worker
5. Hard refresh the page

This confirmed that the envelope logic itself was fixed.

### Future recommendation

When making significant JS/CSS/data changes:

- bump the service worker cache version, or
- use a strategy that prevents stale `script.js`, `style.css`, and `topics.json` from remaining active for too long

The app should not require users to manually unregister the service worker after normal updates.

---

## 7. Envelope behavior

The envelope is a central visual interaction.

Current closed-envelope CSS uses:

```css
background: url('icon/envelope.png') center / contain no-repeat;
```

The open state currently references:

```css
background: url('icon/envelope-paper.png') center / contain no-repeat;
```

but the repository asset is currently named:

`envelope-paper (1).png`

This should eventually be standardized.

Recommended fix:

Rename:

`icon/envelope-paper (1).png`

to:

`icon/envelope-paper.png`

so the CSS path is clean and predictable.

---

## 8. Current envelope logic

The current logic is approximately:

- count valid resources for the topic
- hide the envelope if the count is `0`
- show a Resources label in the envelope without a resource count
- clicking the envelope opens the resource sheet

The relevant behavior is:

```js
els.envWrap.hidden = count === 0;
```

This means a data/configuration mismatch can make the envelope disappear.

Future versions should preserve this behavior only if desired. If a topic has no valid resources, it may be better to:

- not publish that topic at all, or
- show a clear “resources coming soon” state

rather than silently hiding a key UI element.

---

## 9. Permanent “No Wikipedia” enforcement

Wikipedia should be removed from existing topic data and also blocked in code so it cannot reappear accidentally.

Recommended approach:

### A. Clean `topics.json`

Remove or replace every Wikipedia URL already stored in the topic data.

Do **not** replace a Wikipedia entry merely to maintain a fixed number of links.

If a stronger source already exists, simply delete the Wikipedia link.

If Wikipedia was filling an important gap, replace it with a stronger source such as:

- NCBI / NIH
- Stanford Encyclopedia of Philosophy
- official government or regulator pages
- peer-reviewed review papers
- established academic textbooks
- primary research
- expert long-form resources

### B. Enforce the rule in JavaScript

Extend URL validation so Wikipedia is rejected automatically.

For example:

```js
function safeUrl(value) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return null;

    const host = url.hostname.toLowerCase();
    if (host === 'wikipedia.org' || host.endsWith('.wikipedia.org')) {
      return null;
    }

    return url.href;
  } catch {
    return null;
  }
}
```

This makes “no Wikipedia” a product rule, not merely a manual preference.

---

## 10. Existing topic clean-up direction

The current `topics.json` includes Wikipedia in multiple topics.

Known categories where Wikipedia entries should be deleted or replaced include:

- Iron metabolism / absorption
- Luteal phase
- Doomscrolling
- Negativity bias
- Stoicism
- Inflation
- Neural scaling laws
- GDPR
- Circadian rhythm
- Attention residue
- Task switching
- Human multitasking
- Ego depletion
- Replication crisis
- Gut-brain axis
- Enteric nervous system

The principle is:

- replace Wikipedia when a stronger replacement meaningfully improves the topic
- otherwise delete it
- do not add filler just to keep the same number of resources

---

## 11. Visual design language

The visual identity should remain:

- warm
- tactile
- editorial
- slightly vintage
- playful but not childish
- soft and premium
- visually calm
- more like a curated notebook / study desk than a generic productivity app

Current visual motifs include:

- paper cards
- handwritten or editorial typography
- tape / clipped paper
- envelope interactions
- lace / paper textures
- warm neutrals
- subtle motion

The redesign toward scrolling should **preserve this identity**.

---

## 12. Resource sheet image change requested

The user specifically does **not** want a visible cream rectangular background behind the lace/paper asset.

Desired treatment:

- the decorative image should stop exactly at the **lace edges**
- the image should stop at the **top clip**
- everything outside the paper/lace/clip silhouette should be **transparent**
- there should be **no cream rectangular canvas**
- the lace/paper should be significantly **more washed white**
- reduce the yellow/beige cast
- keep a subtle warm vintage feel
- preserve the metallic/gold clip
- resource text must remain readable

The best implementation is to edit the image asset itself rather than trying to fake transparency entirely with CSS.

---

## 13. Product direction: continuous scrolling app

The app should no longer be fundamentally based on:

“One different topic every day.”

Instead, the user wants:

**the same design, but an ongoing scrolling app with many topics.**

### New core experience

The app becomes a vertical discovery feed.

Conceptually:

```text
Header
↓
Topic card
↓
Envelope
↓
Next topic
↓
Envelope
↓
Next topic
↓
...
```

The user should be able to simply keep scrolling.

No need to wait for tomorrow.

---

## 14. Scroll-feed behavior

Each topic should retain the existing visual treatment:

- title
- context
- takeaways
- paper/card styling
- envelope
- resources

Each topic should have its **own envelope**.

Opening an envelope should show only the resources belonging to that topic.

The current single-topic DOM structure will therefore need to become a reusable topic-card component generated from `topics.json`.

### Recommended behavior

- Load an initial batch of topics
- Render them vertically
- Load more as the user approaches the bottom
- Use subtle entrance animations
- Avoid visually heavy transitions
- Keep scrolling smooth on mobile

---

## 15. “Infinite” scrolling philosophy

The app should feel infinite, but should **not simply repeat the same 12 topics forever**.

Preferred model:

- continuously expand the topic library
- progressively load topics from the topic bank
- recycle only if explicitly needed as a temporary fallback

Long term, the content bank should grow to hundreds or thousands of topics.

---

## 16. Header / homepage direction

Keep the existing identity such as:

- “Daily Deep Dive”
- personalized greeting if desired
- short learning-oriented subtitle

The original “New topic” / randomize action becomes less important in a scrolling feed.

Possible replacement:

**Random topic**

which scrolls the user directly to a randomly selected topic.

The name “Daily Deep Dive” can remain even if the content is no longer restricted to one topic per day.

---

## 17. Search

A future version should add search.

Example:

```text
Search topics...
```

Searching “iron” could surface:

- Iron absorption
- Iron deficiency
- Ferritin
- Iron overload
- Heme vs non-heme iron

Search should ideally match:

- topic title
- keywords/tags
- summary/context
- category

---

## 18. Categories

Future topic categories may include:

- Health
- Biology
- Psychology
- Neuroscience
- AI
- Computer Science
- Finance
- Economics
- Law
- Philosophy
- History
- Productivity
- Engineering
- Politics / institutions where relevant
- Culture
- Art
- Business

The category system should help discovery without making the app feel like a rigid database.

---

## 19. Saved topics / favorites

A future topic card should support saving.

Example UI:

`☆` → unsaved

`★` → saved

Saved topics should be available in a separate view later.

Possible future data:

- saved date
- reading progress
- notes
- last opened

---

## 20. Difficulty levels

A future topic may include difficulty metadata such as:

- Beginner
- Intermediate
- Advanced

This should be informative, not intimidating.

Possible JSON field:

```json
"difficulty": "intermediate"
```

---

## 21. Reading-time / commitment indicators

A future version may estimate the depth or time commitment.

Examples:

- 10 min
- 30 min
- 2 hours
- Deep study
- Weekend dive

Avoid false precision if the resource list is extensive.

Possible approach:

- “Quick overview”
- “Focused read”
- “Deep dive”
- “Long-form study”

rather than exact minutes when exact timing is not meaningful.

---

## 22. Future resource hierarchy

The current categories are:

- Books
- Papers
- Videos
- Articles

Long term, a richer hierarchy could be:

- **Start here**
- Books
- Research
- Videos
- Articles
- Tools
- Courses
- Communities

### “Start here”

A “Start here” resource should be the best first resource for someone unfamiliar with the topic.

It should not necessarily be the shortest source.

It should be the source that best creates a strong mental model.

---

## 23. Topic relationships

Future topics should support related-topic discovery.

Example:

```text
If you liked this:
→ Ferritin
→ Heme vs non-heme iron
→ Hepcidin
→ Iron deficiency
```

Possible JSON field:

```json
"relatedTopics": ["topic-id-1", "topic-id-2"]
```

This can create a knowledge graph over time.

---

## 24. Progress tracking

Possible future progress features:

- number of topics viewed
- number of topics saved
- resources opened
- topics completed
- reading streaks
- recently viewed

Example:

```text
137 topics explored
```

Progress should feel encouraging, not gamified to the point of distraction.

---

## 25. Notes

Future versions may allow notes per topic.

Examples:

- personal takeaway
- quote
- idea
- question
- summary

Potentially:

```json
{
  "topicId": "...",
  "notes": "..."
}
```

This can eventually connect to a more personal knowledge system.

---

## 26. Spaced repetition

Long-term optional feature:

Turn saved takeaways or user notes into lightweight review prompts.

Possible behavior:

- revisit key concepts after a few days
- show one short recall question
- surface older topics occasionally

This should remain optional and should not make the product feel like a flashcard app unless the user chooses that mode.

---

## 27. Offline / PWA direction

The app already has:

- `manifest.webmanifest`
- `sw.js`
- app icons

Future goals:

- reliable offline access to already-loaded topics
- cache important UI assets
- avoid stale-code problems
- allow installation as a PWA
- support mobile-first browsing

---

## 28. No advertisements

Long-term product aspiration:

- no ads
- no clutter
- no algorithmic engagement tricks
- no low-quality sponsored learning content

The product should feel like a clean personal library.

---

## 29. Larger product vision

The long-term vision is closer to:

**Pinterest × Obsidian × Britannica**

but designed specifically for:

- intellectual discovery
- deep learning
- curated resources
- personal knowledge exploration

The app should feel more intentional than social media and more visually inviting than a conventional encyclopedia.

---

## 30. Content expansion goal

The current topic bank is small.

Long-term target:

- hundreds of topics
- eventually thousands

Topics should span many disciplines but retain consistent quality.

A topic should only be added when there is enough good material to support it.

Avoid mass-generating shallow topic entries.

---

## 31. Future topic metadata

A future topic object could evolve toward:

```json
{
  "id": "iron-absorption",
  "title": "Iron absorption",
  "subtitle": "Why what you eat with iron matters",
  "category": "Health",
  "difficulty": "intermediate",
  "context": "...",
  "takeaways": [
    "...",
    "...",
    "..."
  ],
  "tags": [
    "nutrition",
    "iron",
    "hepcidin"
  ],
  "relatedTopics": [
    "ferritin",
    "iron-deficiency"
  ],
  "ressources": {
    "startHere": [],
    "books": [],
    "papers": [],
    "videos": [],
    "articles": [],
    "tools": [],
    "courses": []
  }
}
```

Do not migrate to this schema all at once unless the code is updated accordingly.

---

## 32. Recommended technical architecture for the scroll version

### `index.html`

Use a main feed container, for example:

```html
<main id="topic-feed" class="topic-feed"></main>
```

Topic cards should be generated with JavaScript.

The resource sheet/modal can remain global if it is dynamically populated from whichever topic envelope is clicked.

### `script.js`

Recommended structure:

- load topics
- validate topics
- filter unsafe / Wikipedia URLs
- render initial topic batch
- attach envelope event handling
- lazy-load more topics using `IntersectionObserver`
- open resource sheet for the clicked topic
- support search/filter later
- persist favorites later

### `style.css`

Preserve the current visual system but change layout from a single centered stage to:

- vertically stacked topic sections
- responsive spacing
- enough room between topics
- envelope aligned naturally with each card

---

## 33. Performance considerations

As the topic library grows:

Do not render thousands of topics at once.

Use:

- batches
- lazy rendering
- `IntersectionObserver`
- lightweight DOM
- image optimization
- minimal duplicated listeners

Possible initial behavior:

- render 10–20 topics
- append the next 10–20 near the bottom

---

## 34. Accessibility

Preserve or improve:

- real buttons for envelopes
- keyboard focus states
- `aria-expanded`
- `aria-controls`
- modal/dialog semantics
- readable color contrast
- reduced-motion support
- meaningful labels

The visual design should not compromise accessibility.

---

## 35. Current HTML issue to clean up

There is a malformed favicon line in `index.html`.

Current:

```html
<link rel="icon" href="icon/icon-192.png" type="image/png">">
```

Correct:

```html
<link rel="icon" href="icon/icon-192.png" type="image/png">
```

This is not what caused the envelope bug, but it should be fixed.

---

## 36. Do not accidentally undo these decisions

Future changes should preserve the following unless explicitly requested otherwise:

- use `icon/`, not `icons/`
- resource groups must match the actual JSON keys
- no Wikipedia
- resource quality over resource quantity
- preserve the tactile/editorial visual identity
- envelope remains an important interaction
- the product direction is continuous scrolling, not one-topic-per-day
- do not fill resource lists with weak sources
- do not introduce generic corporate/productivity-app styling
- do not add unnecessary clutter
- do not use a visible cream rectangle behind the lace resource paper
- paper/lace treatment should be lighter, whiter, and transparent outside its actual shape

---

## 37. Immediate next steps

### High priority

1. Convert the current app from one-topic-per-day to a vertical scrolling feed.
2. Make each topic card have its own envelope interaction.
3. Keep the existing visual design.
4. Clean all Wikipedia links from `topics.json`.
5. Add code-level Wikipedia blocking.
6. Fix the resource-paper image:
   - transparent outside lace/clip
   - washed white
   - reduced yellow cast
7. Fix the favicon typo.
8. Normalize the `envelope-paper` filename.
9. Improve service worker update behavior to avoid stale code.

### Medium priority

10. Add search.
11. Add categories/tags.
12. Add favorites.
13. Add related topics.
14. Add difficulty/depth indicators.
15. Add progressive/lazy topic loading.

### Long-term

16. Build a much larger curated topic bank.
17. Add notes.
18. Add progress tracking.
19. Add optional spaced repetition.
20. Improve offline/PWA behavior.
21. Turn the app into a personal deep-learning knowledge platform.

---

## 38. Product success criteria

A successful version of Daily Deep Dive should make the user feel:

- “I want to keep scrolling because every topic is interesting.”
- “The resources are actually worth opening.”
- “This is deeper than social media.”
- “This is easier and more inviting than searching manually.”
- “I trust the curation.”

- “The design makes learning feel enjoyable.”

The app should reward curiosity rather than attention capture.

---

## 39. Guiding sentence

**Daily Deep Dive is a beautiful, endlessly scrollable library of carefully curated ideas, where every topic gives the user enough context to understand why it matters and enough high-quality resources to genuinely go deeper.**

## 40. Commercial direction — 17 September 2026

The final goal is a marketable app with a distinctive, authored visual identity that does not look AI generated. Lucile will upload new images later to improve the overall design. Preserve the envelope, editorial typography, tactile paper, calm browsing, and curation rules while those assets evolve.

Implemented foundation: batched vertical collection, topic-specific envelopes, search, category filtering, local saved topics, Wikipedia removal and URL blocking, normalized envelope filename, portable manifest, and network-first offline shell.

The collection stops when available topics are exhausted; it does not repeat or invent topics. Search placeholders have now been removed; direct resources carry dated review levels in source-audit.json. Resource-paper container is transparent; exact lace/clip silhouette and washed-white artwork still require replacement assets. The source audit records its full-text access limits; there is no claim of store readiness.

Next milestones: human-reviewed source library expansion; final transparent artwork and visual QA; topic relationships and notes; accessible product testing; decide accounts, sync, pricing, content rights, privacy disclosures, and distribution before commercial launch. No advertising or sponsored filler.


## Latest direction — 17 September 2026

Do not display the number of resources on or above an envelope. Keep the Resources label and the topic-specific interaction. Resource counts are only used internally to exclude empty entries.

Expand the curated collection around finance (especially bonds), glucose and fructose, individual vitamins, body mechanisms and biochemistry, marketing, evidence-based study methods, law, and politics. Refine broad interests into focused questions; these interests guide expansion and do not limit the app to these disciplines. This update adds 52 focused topics, bringing the collection to 64. New entries link directly to textbooks, research educators, regulators and international institutions. Avoid resource quotas and Wikipedia. Continue toward a much larger authored collection and commercial app with distinctive artwork.

Linking readers to external materials does not license reproduction of those materials. Retain original card text; verify jurisdiction-specific legal details and medical claims against current primary sources before commercial release.


## Open-ended discovery — latest user clarification

The collection must not have a fixed target number or a closed list of disciplines. Continuously research and add distinct subjects. The 64 topics in this update are a starting collection, not a cap. Interests include dopamine, social media, geopolitics, current wars, investments, intellectual property, scientific experiments, history (including the Vietnam War), brain mechanisms, cell mechanisms, health and food, as well as bonds, vitamins, marketing, study techniques and law. These are examples, not an exhaustive taxonomy.

Refine interests into explanatory questions. Rotate disciplines, avoid duplicates, and distinguish related mechanisms instead of repackaging the same topic. Preserve substantive, credible sources and the absolute Wikipedia exclusion. For current wars and other evolving subjects, verify event dates, identify jurisdictions and actors, use multiple independent credible sources, and record lastVerified and asOf dates in topic metadata. Present contested claims with attribution rather than certainty. For experiments, distinguish observed results, replication evidence and interpretation.

An ongoing background research task can extend topics.json; the current static feed reads that collection when it loads. This does not create unlimited topics immediately at the end of a scroll. A future production content service should supply new reviewed topics through cursor-based pagination, with background sourcing, validation, deduplication and refresh of dated entries. Preserve existing cards and saved IDs when new content arrives. Never repeat cards or invent sources to simulate an infinite collection.


## Daily publishing and source audit — 17 September 2026

Add at least 10 distinct, adequately sourced and verified new topics every daily research run. The collection has no maximum size. Do not impose a resource count or force every resource type. Rotate disciplines, avoid duplicates, preserve IDs, and never add filler or fabricated citations to meet the minimum. If access or execution blocks the minimum, report the exact shortfall and blocker.

All 169 previous resource entries have been assessed. The updated bibliography contains 100 direct entries and no search placeholders. See SOURCE_AUDIT.md and source-audit.json for decisions and review limits. Each resource has a dated verification record distinguishing readable text/selected-section review from bibliographic identity and abstract checks; never equate these. Full-text access remains incomplete for 21 papers and the UNCITRAL convention materials. The first 12 cards were corrected to match the evidence reviewed.

For every new publication, confirm the direct destination, responsible author/institution, identity, depth, relevance and support for the card's actual claims. Preserve verification evidence in the audit ledger. Do not call a paywalled abstract a full-text review. Use substantive accessible material for the core explanation when available; identify access limits honestly. For evolving subjects, verify current facts against authoritative evidence, record asOf/lastVerified, and separate competing claims, observation, interpretation and causal findings.
