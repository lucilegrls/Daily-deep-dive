/* ==========================================================================
   Daily deep dive — script.js
   - Picks the same topic for everyone on a given day (deterministic shuffle)
   - "New topic" shows a different one without repeating until the bank runs out
   - Envelope opens a sheet with the ressources
   - Phase 3 hook: optional AI topics through your own serverless endpoint
   ========================================================================== */
(() => {
  'use strict';

  const CONFIG = {
    userName: 'Lucile',
    topicsUrl: 'topics.json',
    shuffleSeed: 2026,
    // Phase 3: set this to your serverless function (e.g. '/.netlify/functions/new-topic').
    // Never put a Claude API key in this file: anyone can read it.
    aiEndpoint: null,
    aiShare: 0.4, // share of "New topic" taps that ask for an AI topic once aiEndpoint is set
  };

  const GROUPS = [
    { key: 'books', label: 'Books', icon: '📚', meta: r => [r.author && `by ${r.author}`, r.hook].filter(Boolean).join('. ') },
    { key: 'papers', label: 'Research papers', icon: '📄', meta: r => r.source },
    { key: 'videos', label: 'Videos', icon: '🎥', meta: r => r.creator },
    { key: 'articles', label: 'Articles', icon: '📰', meta: r => r.publication },
  ];

  // localStorage can be blocked (private mode, embedded views): never let it break the page
  const store = {
    get(key) { try { return window.localStorage.getItem(key); } catch (e) { return null; } },
    set(key, value) { try { window.localStorage.setItem(key, value); } catch (e) { /* ignore */ } },
  };

  const state = {
    topics: [],
    todayId: null,
    current: null,
    seen: new Set(),
    busy: false,
    sheetOpen: false,
    lastFocus: null,
  };

  const $ = id => document.getElementById(id);
  const els = {};
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Dates ---------- */
  const openedAt = new Date();
  const dayNumber = d => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);

  function greetingFor(d) {
    const h = d.getHours();
    if (h < 5) return 'Still up';
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  }

  /* ---------- Deterministic daily pick ---------- */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffled(list, seed) {
    const rand = mulberry32(seed);
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  // Each "cycle" (one pass through the whole bank) gets its own order, so no repeats within a cycle.
  function pickTodayId(topics, date) {
    const ids = topics.map(t => t.id).sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
    const n = ids.length;
    const day = dayNumber(date);
    const order = shuffled(ids, CONFIG.shuffleSeed + Math.floor(day / n));
    return order[day % n];
  }

  /* ---------- Data ---------- */
  async function loadTopics() {
    // The published single-file preview inlines the data here
    if (window.__DDD_TOPICS__) return window.__DDD_TOPICS__.topics;
    const res = await fetch(CONFIG.topicsUrl, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`topics.json returned ${res.status}`);
    const data = await res.json();
    return data.topics;
  }

  function isValidTopic(t) {
    return Boolean(
      t && t.id != null &&
      typeof t.title === 'string' && t.title.trim() &&
      typeof t.context === 'string' &&
      Array.isArray(t.takeaways) &&
      t.ressources && typeof t.ressources === 'object'
    );
  }

  function safeUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
    } catch (e) {
      return null;
    }
  }

  const ressourceCount = topic =>
    GROUPS.reduce((sum, g) => sum + (topic.ressources[g.key] || []).filter(r => r && safeUrl(r.url)).length, 0);

  /* ---------- Phase 3: AI topics (inactive until aiEndpoint is set) ---------- */
  async function fetchAiTopic() {
    const res = await fetch(CONFIG.aiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avoidTitles: state.topics.map(t => t.title) }),
    });
    if (!res.ok) throw new Error(`AI endpoint returned ${res.status}`);
    const topic = await res.json();
    topic.id = `ai-${Date.now()}`;
    if (!isValidTopic(topic)) throw new Error('AI topic is missing fields');
    topic.source = 'ai';
    return topic;
  }

  /* ---------- Rendering ---------- */
  function el(tag, props, children) {
    const node = document.createElement(tag);
    Object.entries(props || {}).forEach(([key, value]) => {
      if (value == null || value === false) return;
      if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = value;
      else node.setAttribute(key, value);
    });
    [].concat(children || []).forEach(child => { if (child != null) node.append(child); });
    return node;
  }

  function splitTitle(title) {
    const i = title.indexOf(':');
    if (i < 1) return ['', title];
    return [title.slice(0, i).trim(), title.slice(i + 1).trim()];
  }

  function pickLabelFor(topic) {
    if (topic.id === state.todayId) return "Today's pick";
    if (topic.source === 'ai') return 'Fresh from Claude';
    return 'Bonus dive';
  }

  function renderTopic(topic) {
    const [lead, rest] = splitTitle(topic.title);
    const count = ressourceCount(topic);

    els.tag.textContent = topic.category || 'Deep dive';
    els.pick.textContent = pickLabelFor(topic);
    els.titleLead.textContent = lead;
    els.titleRest.textContent = rest;
    els.context.textContent = topic.context;
    els.takeaways.replaceChildren(...topic.takeaways.map(text => el('li', { text })));
    els.takeawaysLabel.hidden = topic.takeaways.length === 0;
    els.backToday.hidden = topic.id === state.todayId;

    els.envWrap.hidden = count === 0;
    els.envCount.textContent = count === 1 ? '1 link inside' : `${count} links inside`;
    els.envelope.setAttribute('aria-label', `Open ressources: ${count} links for ${topic.title}`);

    renderSheet(topic);
    els.live.textContent = `Now showing: ${topic.title}`;
  }

  function renderSheet(topic) {
    els.sheetTitle.textContent = topic.title;
    const groups = GROUPS.map(group => {
      const items = (topic.ressources[group.key] || []).filter(r => r && r.title && safeUrl(r.url));
      if (!items.length) return null;
      // If every link in a group opens the same kind of search, say it once under the heading
      const kinds = new Set(items.map(r => (r.search ? r.searchLabel || 'search' : '')));
      const sharedKind = kinds.size === 1 && items[0].search ? [...kinds][0] : null;
      return el('section', { class: `r-group r-group--${group.key}` }, [
        el('h3', { class: 'r-heading' }, [
          el('span', { class: 'r-icon', 'aria-hidden': 'true', text: group.icon }),
          el('span', { text: group.label }),
        ]),
        sharedKind ? el('p', { class: 'r-group-note', text: `Each link opens a ${sharedKind}` }) : null,
        el('ul', { class: 'r-list' }, items.map(r => {
          const meta = group.meta(r);
          return el('li', { class: 'r-item' }, [
            el('a', { class: 'r-link', href: safeUrl(r.url), target: '_blank', rel: 'noopener noreferrer' }, [
              r.title,
              el('span', { class: 'sr-only', text: ' (opens in a new tab)' }),
            ]),
            meta ? el('p', { class: 'r-meta', text: meta }) : null,
            r.search && !sharedKind ? el('span', { class: 'r-note', text: `Opens a ${r.searchLabel || 'search'}` }) : null,
          ]);
        })),
      ]);
    }).filter(Boolean);
    els.sheetBody.replaceChildren(...groups);
  }

  function renderError(message) {
    els.tag.textContent = 'Nothing loaded';
    els.pick.textContent = '';
    els.titleLead.textContent = '';
    els.titleRest.textContent = "Today's topic didn't load";
    els.context.textContent = message;
    els.takeaways.replaceChildren();
    els.takeawaysLabel.hidden = true;
    els.envWrap.hidden = true;
  }

  async function showTopic(topic, animate) {
    state.current = topic;
    state.seen.add(topic.id);
    if (!animate || reduceMotion()) {
      renderTopic(topic);
      return;
    }
    const moving = [els.card, els.envWrap];
    moving.forEach(n => n.classList.add('is-leaving'));
    await wait(280);
    renderTopic(topic);
    moving.forEach(n => { n.classList.remove('is-leaving'); n.classList.add('is-entering'); });
    void els.card.offsetWidth; // commit the start position before animating in
    moving.forEach(n => n.classList.remove('is-entering'));
  }

  /* ---------- Actions ---------- */
  function randomCuratedTopic() {
    let pool = state.topics.filter(t => !state.seen.has(t.id));
    if (!pool.length) {
      // Whole bank seen this session: start over, but never repeat the current one
      state.seen = new Set([state.current && state.current.id]);
      pool = state.topics.filter(t => !state.seen.has(t.id));
    }
    return pool[Math.floor(Math.random() * pool.length)] || state.topics[0];
  }

  async function refresh() {
    if (state.busy || !state.topics.length) return;
    state.busy = true;
    document.body.classList.remove('is-arriving');
    if (state.sheetOpen) closeSheet(false);
    els.refresh.setAttribute('aria-busy', 'true');
    els.refresh.classList.remove('is-spinning');
    void els.refresh.offsetWidth;
    els.refresh.classList.add('is-spinning');
    try {
      let next = null;
      if (CONFIG.aiEndpoint && Math.random() < CONFIG.aiShare) {
        next = await fetchAiTopic().catch(err => { console.warn(err); return null; });
      }
      await showTopic(next || randomCuratedTopic(), true);
    } finally {
      els.refresh.removeAttribute('aria-busy');
      state.busy = false;
    }
  }

  async function backToToday() {
    const today = state.topics.find(t => t.id === state.todayId);
    if (today && !state.busy) {
      state.busy = true;
      await showTopic(today, true);
      state.busy = false;
      els.refresh.focus({ preventScroll: true });
    }
  }

  /* ---------- Envelope + sheet ---------- */
  function openSheet() {
    if (state.sheetOpen) return;
    state.sheetOpen = true;
    state.lastFocus = document.activeElement;
    els.envelope.classList.add('is-open');
    els.envelope.setAttribute('aria-expanded', 'true');

    setTimeout(() => {
      if (!state.sheetOpen) return;
      document.body.classList.add('sheet-open');
      els.sheet.setAttribute('aria-hidden', 'false');
      els.sheet.classList.add('is-visible');
      els.backdrop.classList.add('is-visible');
      els.sheetScroll.scrollTop = 0;
      els.sheetClose.focus({ preventScroll: true });
    }, reduceMotion() ? 0 : 480);
  }

  function closeSheet(restoreFocus = true) {
    if (!state.sheetOpen) return;
    state.sheetOpen = false;
    els.sheet.classList.remove('is-visible');
    els.backdrop.classList.remove('is-visible');
    els.sheet.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('sheet-open');
    setTimeout(() => {
      els.envelope.classList.remove('is-open');
      els.envelope.setAttribute('aria-expanded', 'false');
    }, reduceMotion() ? 0 : 220);
    if (restoreFocus) (state.lastFocus || els.envelope).focus({ preventScroll: true });
  }

  function onKeydown(event) {
    if (!state.sheetOpen) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeSheet();
      return;
    }
    if (event.key === 'Tab') {
      const focusable = Array.from(els.sheet.querySelectorAll('a[href], button:not([disabled])'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  }

  /* ---------- Theme ---------- */
  function effectiveTheme() {
    const chosen = document.documentElement.dataset.theme;
    if (chosen === 'light' || chosen === 'dark') return chosen;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function syncThemeButton() {
    const dark = effectiveTheme() === 'dark';
    els.theme.dataset.mode = dark ? 'dark' : 'light';
    els.theme.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
  }

  function initTheme() {
    const saved = store.get('ddd-theme');
    if (saved === 'light' || saved === 'dark') document.documentElement.dataset.theme = saved;
    syncThemeButton();
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    if (media.addEventListener) media.addEventListener('change', syncThemeButton);
  }

  function toggleTheme() {
    const next = effectiveTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    store.set('ddd-theme', next);
    syncThemeButton();
  }

  /* ---------- Offline support (hosted version only) ---------- */
  function registerServiceWorker() {
    if (window.__DDD_TOPICS__ || !('serviceWorker' in navigator)) return;
    if (!/^https?:$/.test(location.protocol)) return;
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('Service worker not registered', err));
  }

  /* ---------- Start ---------- */
  async function init() {
    Object.assign(els, {
      date: $('date'), greeting: $('greeting'), theme: $('theme-toggle'), refresh: $('refresh'),
      card: $('card'), tag: $('topic-tag'), pick: $('pick-label'),
      titleLead: $('title-lead'), titleRest: $('title-rest'), context: $('topic-context'),
      takeaways: $('topic-takeaways'), takeawaysLabel: $('takeaways-label'), backToday: $('back-today'),
      envWrap: $('envelope-wrap'), envelope: $('envelope'), envCount: $('env-count'), envHint: $('env-hint'),
      bankCount: $('bank-count'), live: $('live'),
      backdrop: $('sheet-backdrop'), sheet: $('sheet'), sheetScroll: $('sheet-scroll'),
      sheetTitle: $('sheet-title'), sheetBody: $('sheet-body'), sheetClose: $('sheet-close'),
    });

    els.date.textContent = openedAt.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    els.greeting.textContent = `${greetingFor(openedAt)}, ${CONFIG.userName}`;
    initTheme();

    els.theme.addEventListener('click', toggleTheme);
    els.refresh.addEventListener('click', refresh);
    els.backToday.addEventListener('click', backToToday);
    els.envelope.addEventListener('click', () => (state.sheetOpen ? closeSheet() : openSheet()));
    els.backdrop.addEventListener('click', () => closeSheet());
    els.sheetClose.addEventListener('click', () => closeSheet());
    document.addEventListener('keydown', onKeydown);

    // If the app stays open past midnight, show the new day's pick when it comes back into view
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && dayNumber(new Date()) !== dayNumber(openedAt)) {
        location.reload();
      }
    });

    try {
      const topics = (await loadTopics() || []).filter(isValidTopic);
      if (!topics.length) throw new Error('topics.json has no valid topics');
      state.topics = topics;
      state.todayId = pickTodayId(topics, openedAt);
      await showTopic(topics.find(t => t.id === state.todayId), false);
      els.bankCount.textContent = `${topics.length} curated topics in the bank`;
    } catch (err) {
      console.error(err);
      const fromDisk = location.protocol === 'file:';
      renderError(fromDisk
        ? 'The page was opened straight from your files, so the browser blocked topics.json. Run a local server (see README) or open the hosted link.'
        : 'topics.json could not be read. Check that the file sits next to index.html and is valid JSON, then reload.');
    }

    document.body.classList.add('is-ready', 'is-arriving');
    setTimeout(() => document.body.classList.remove('is-arriving'), reduceMotion() ? 0 : 1400);
    registerServiceWorker();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
