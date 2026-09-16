# Daily deep dive

A new rabbit hole every day: one specific topic, why it matters, what's worth remembering, and an envelope of ressources (books, papers, videos, articles) to follow it further.

Made for Lucile. Mobile first, installable on an Android home screen, no app store needed.

## What's in the folder

| File | What it does |
| --- | --- |
| `index.html` | Page structure: header, topic card, envelope, ressources sheet |
| `style.css` | Colors, type, backdrop, envelope animation, dark mode, responsive layout |
| `script.js` | Daily pick, "New topic" button, envelope and sheet, theme toggle |
| `topics.json` | The curated topic bank (12 topics to start) |
| `manifest.webmanifest` | Lets Android install it like an app |
| `sw.js` | Offline support, so it still opens without a connection |
| `icons/` | Home screen icons |

## How it picks a topic

Every day gets one topic from the bank, chosen by a fixed shuffle of the dates, so it stays the same all day and doesn't repeat until you've been through the whole bank. "New topic" shows a different one right away; "Back to today's pick" returns to the day's topic. Adding topics changes the rotation, which is fine.

## Try it on your computer

Browsers block `topics.json` when you double-click `index.html`, so run a tiny local server from inside the folder:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Put it online (free)

**Netlify Drop (easiest, about 2 minutes)**
1. Go to https://app.netlify.com/drop and sign in.
2. Drag the whole `daily-deep-dive` folder onto the page.
3. You'll get a link like `something-random.netlify.app`. Rename it under *Site configuration → Change site name* (for example `lucile-daily-deep-dive`).
4. To update later, open the site in Netlify, go to *Deploys*, and drag the folder in again.

**GitHub Pages**
1. Create a new public repository, for example `daily-deep-dive`.
2. Upload all the files (keep the `icons` folder).
3. Go to *Settings → Pages*, set *Source* to *Deploy from a branch*, choose `main` and `/ (root)`, and save.
4. After a minute your site is at `https://YOUR-USERNAME.github.io/daily-deep-dive/`.

## Add it to your Android home screen

1. Open your live link in **Chrome** on your phone.
2. Tap the **⋮** menu (top right).
3. Tap **Add to home screen** (on some phones it says **Install app**), then **Install** or **Add**.
4. The envelope icon appears on your home screen and opens full screen, like an app.

If you update the site and don't see changes, close the app fully and reopen it; it always fetches the latest version when you're online.

## Add or edit topics

Open `topics.json` and add an object to the `topics` list. Give it a new `id`.

```json
{
  "id": 13,
  "category": "Productivity & focus",
  "title": "Time blocking: Planning your day in chunks",
  "context": "Two or three sentences on what you'll discover and why it's useful.",
  "takeaways": [
    "Three or four things worth remembering.",
    "Keep each one to a sentence."
  ],
  "ressources": {
    "books":    [{ "title": "", "author": "", "hook": "", "url": "https://..." }],
    "papers":   [{ "title": "", "source": "", "url": "https://..." }],
    "videos":   [{ "title": "", "creator": "", "url": "https://..." }],
    "articles": [{ "title": "", "publication": "", "url": "https://..." }]
  }
}
```

Guidelines from the brief: specific titles (never just "Biochemistry"), sentence case, a warm and conversational tone, and 2 to 3 items in each ressource group.

A title with a colon is shown in two parts: the words before the colon become the big headline.

### About the links

- Articles and arXiv papers point straight to the page.
- Books open a **Goodreads search**, videos a **YouTube search**, and most papers a **PubMed** or **Google Scholar** search. These always load, and they usually show the exact item first. Items like this have `"search": true` and the sheet says so.
- When you've found the exact page you like, paste its link into `url` and delete the `search` and `searchLabel` lines.
- Test links from time to time; websites move things.

## Next steps (Phase 3: AI topics)

`script.js` already has a switch for AI-generated topics (`CONFIG.aiEndpoint`), turned off for now.

Important: **never put a Claude API key in `script.js`.** Anyone who opens the site can read it. Instead:

1. Create a small serverless function (Netlify Functions or Vercel both have free tiers) that stores the key as a secret environment variable.
2. The function calls the Claude API, asks for one topic in the same JSON shape as `topics.json`, checks it, and returns it.
3. Set `aiEndpoint` in `script.js` to that function's address (for example `/.netlify/functions/new-topic`).
4. About 40% of "New topic" taps will then ask for a fresh AI topic, falling back to the curated bank if anything fails.

Also worth planning: AI-suggested links need checking, because language models can invent URLs. Keeping AI ressources as search links is a safe default.

## Ideas for later

Favorites, an archive of past topics, filters by category, sharing a topic, and reading-time estimates.
