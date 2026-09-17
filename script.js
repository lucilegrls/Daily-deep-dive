/* Deep Dive — progressively rendered curiosity collection. */
(() => {
  'use strict';

  const CONFIG = {
    topicUrls: ['topics.json', 'topics-critical-thinking.json'],
    batchSize: 4,
  };

  const GROUPS = [
    {
      key: 'books',
      label: 'Books',
      icon: '📚',
      meta: r => [r.author].filter(Boolean).join(' • ')
    },
    {
      key: 'papers',
      label: 'Papers',
      icon: '📄',
      meta: r => [r.source].filter(Boolean).join(' • ')
    },
    {
      key: 'videos',
      label: 'Videos',
      icon: '▶️',
      meta: r => [r.creator ? r.creator.replace(/\s*·\s*framing resource.*$/i, '') : ''].filter(Boolean).join(' • ')
    },
    {
      key: 'articles',
      label: 'Articles',
      icon: '📰',
      meta: r => [r.publication].filter(Boolean).join(' • ')
    },
  ];

  // localStorage can be blocked (private mode, embedded views): never let it break the page
  const store = {
    get(key) { try { return window.localStorage.getItem(key); } catch (e) { return null; } },
    set(key, value) { try { window.localStorage.setItem(key, value); } catch (e) { /* ignore */ } },
  };

  let saved;
  try { saved = JSON.parse(store.get('ddd-saved') || '[]'); } catch { saved = []; }
  const state = {
    topics: [], filtered: [], rendered: 0, saved: new Set(Array.isArray(saved) ? saved.map(String) : []),
    savedOnly: false, sheetOpen: false, lastFocus: null, envelope: null,
  };

  const $ = id => document.getElementById(id);
  const els = {};
  const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Data ---------- */
  async function loadTopics() {
    // The published single-file preview inlines the main data here.
    const topicSets = [];
    if (window.__DDD_TOPICS__ && Array.isArray(window.__DDD_TOPICS__.topics)) {
      topicSets.push(window.__DDD_TOPICS__.topics);
    } else {
      const main = await fetch('topics.json', { cache: 'no-cache' });
      if (!main.ok) throw new Error(`topics.json returned ${main.status}`);
      const data = await main.json();
      topicSets.push(data.topics || []);
    }

    // Editorial packs are optional: the core collection still loads if one is temporarily unavailable.
    for (const url of CONFIG.topicUrls.filter(url => url !== 'topics.json')) {
      try {
        const res = await fetch(url, { cache: 'no-cache' });
        if (!res.ok) continue;
        const data = await res.json();
        if (Array.isArray(data.topics)) topicSets.push(data.topics);
      } catch (e) {
        console.warn(`Optional topic pack could not load: ${url}`, e);
      }
    }

    const seen = new Set();
    return topicSets.flat().filter(topic => {
      const key = String(topic && topic.id);
      if (!topic || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
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
      if (!['https:', 'http:'].includes(url.protocol)) return null;
      if (url.hostname === 'wikipedia.org' || url.hostname.endsWith('.wikipedia.org')) return null;
      return url.href;
    } catch (e) {
      return null;
    }
  }

  const ressourceCount = topic =>
    GROUPS.reduce((sum, g) => sum + (topic.ressources[g.key] || []).filter(r => r && safeUrl(r.url)).length, 0);

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

  function renderCriticalThinking(topic) {
    if (!Array.isArray(topic.criticalThinking) || !topic.criticalThinking.length) return null;
    return el('aside', { class: 'critical-thinking', 'aria-label': 'Critical thinking prompts' }, [
      el('h3', { class: 'section-label critical-thinking-label', text: 'Question the idea' }),
      el('p', { class: 'critical-thinking-intro', text: 'Before you accept the explanation, test it:' }),
      el('ul', { class: 'critical-thinking-list' }, topic.criticalThinking.map(text => el('li', { text }))),
    ]);
  }

  function renderCard(topic) {
    const key = String(topic.id);
    const [lead, rest] = splitTitle(topic.title);
    const save = el('button', { type: 'button', class: 'text-btn save-topic', 'aria-pressed': state.saved.has(key), text: state.saved.has(key) ? 'Saved' : 'Save topic' });
    save.setAttribute('aria-pressed', String(state.saved.has(key)));
    save.addEventListener('click', () => {
      state.saved.has(key) ? state.saved.delete(key) : state.saved.add(key);
      store.set('ddd-saved', JSON.stringify([...state.saved]));
      save.textContent = state.saved.has(key) ? 'Saved' : 'Save topic';
      save.setAttribute('aria-pressed', String(state.saved.has(key)));
      if (state.savedOnly) filterTopics();
    });
    const heading = `topic-${state.topics.indexOf(topic)}`;
    const cardChildren = [
      el('span', { class: 'tape', 'aria-hidden': 'true' }),
      el('div', { class: 'card-top' }, [el('span', { class: 'tag', text: topic.category || 'Deep dive' }), save]),
      el('h2', { class: 'title', id: heading }, [el('span', { class: 'title-lead', text: lead }), el('span', { class: 'title-rest', text: rest })]),
      el('p', { class: 'context', text: topic.context }),
      el('h3', { class: 'section-label', text: 'Worth remembering' }),
      el('ul', { class: 'takeaways' }, topic.takeaways.map(text => el('li', { text }))),
    ];
    const criticalThinking = renderCriticalThinking(topic);
    if (criticalThinking) cardChildren.push(criticalThinking);

    const card = el('article', { class: 'card', 'aria-labelledby': heading }, cardChildren);
    const envelope = el('button', { type: 'button', class: 'envelope', 'aria-expanded': 'false', 'aria-controls': 'sheet', 'aria-label': `Open resources for ${topic.title}` }, [
      el('span', { class: 'env-label', text: 'Resources' }),
    ]);
    envelope.addEventListener('click', () => {
      renderSheet(topic);
      state.envelope = envelope;
      openSheet();
    });
    return el('section', { class: 'stage topic-entry', 'data-topic-id': key }, [card, el('div', { class: 'envelope-wrap' }, [envelope, el('p', { class: 'env-hint', text: 'follow the evidence', 'aria-hidden': 'true' })])]);
  }

  function appendBatch() {
    const next = state.filtered.slice(state.rendered, state.rendered + CONFIG.batchSize);
    els.feed.append(...next.map(renderCard));
    state.rendered += next.length;
    els.loadMore.hidden = state.rendered >= state.filtered.length;
    els.status.textContent = !state.filtered.length ? (state.savedOnly ? 'No saved topics match yet. Save an idea from the collection to keep it here.' : 'No topics match. Try another question or subject.')
      : state.rendered >= state.filtered.length ? 'You’ve reached the end of this collection. More carefully chosen topics will follow.' : '';
    els.bankCount.textContent = els.search.value.trim() || els.category.value || state.savedOnly ? `${state.filtered.length} matching topics` : 'A growing collection of ideas';
  }

  function filterTopics() {
    const query = els.search.value.trim().toLocaleLowerCase();
    state.filtered = state.topics.filter(t => (!state.savedOnly || state.saved.has(String(t.id))) &&
      (!els.category.value || t.category === els.category.value) &&
      [t.title, t.context, t.category, ...(t.tags || []), ...t.takeaways, ...(t.criticalThinking || [])].join(' ').toLocaleLowerCase().includes(query));
    state.rendered = 0;
    els.feed.replaceChildren();
    appendBatch();
  }

  function renderSheet(topic) {
    els.sheetTitle.textContent = topic.title;
    const groups = GROUPS.map(group => {
      const items = (topic.ressources[group.key] || []).filter(r => r && r.title && safeUrl(r.url));
      if (!items.length) return null;
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
          const typeLabel = r.type ? r.type.charAt(0).toUpperCase() + r.type.slice(1) : '';
          return el('li', { class: 'r-item', 'data-type': r.type || '' }, [
            typeLabel ? el('span', { class: 'r-type-badge', text: typeLabel }) : null,
            el('a', { class: 'r-link', href: safeUrl(r.url), target: '_blank', rel: 'noopener noreferrer' }, [
              r.title,
              el('span', { class: 'sr-only', text: ' (opens in a new tab)' }),
            ]),
            meta ? el('p', { class: 'r-meta', text: meta }) : null,
            (r.description || r.hook) ? el('p', { class: 'r-description', text: r.description || r.hook }) : null,
            r.search && !sharedKind ? el('span', { class: 'r-note', text: `Opens a ${r.searchLabel || 'search'}` }) : null,
          ]);
        })),
      ]);
    }).filter(Boolean);

    const evidenceNote = el('section', { class: 'r-group r-group--evidence' }, [
      el('h3', { class: 'r-heading' }, [el('span', { text: 'How to use these resources' })]),
      el('p', { class: 'r-description', text: 'Source format does not determine authority. Papers, books, official documents, expert videos, lectures, interviews, documentaries and podcasts can all be substantive when they are credible and well matched to the topic. Inspect what each source actually supports and where its limits are.' }),
    ]);
    els.sheetBody.replaceChildren(evidenceNote, ...groups);
  }

  /* ---------- Envelope + sheet ---------- */
  function openSheet() {
    if (state.sheetOpen) return;
    state.sheetOpen = true;
    state.lastFocus = document.activeElement;
    state.envelope.classList.add('is-open');
    state.envelope.setAttribute('aria-expanded', 'true');

    setTimeout(() => {
      if (!state.sheetOpen) return;
      document.body.classList.add('sheet-open');
      els.sheet.setAttribute('aria-hidden', 'false');
      els.page.inert = true;
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
    els.page.inert = false;
    document.body.classList.remove('sheet-open');
    state.envelope.classList.remove('is-open');
    state.envelope.setAttribute('aria-expanded', 'false');
    if (restoreFocus) (state.lastFocus || state.envelope).focus({ preventScroll: true });
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

  async function init() {
    Object.assign(els, {
      page: document.querySelector('.page'), theme: $('theme-toggle'), refresh: $('refresh'),
      feed: $('topic-feed'), search: $('search'), category: $('category'), savedFilter: $('saved-filter'),
      status: $('feed-status'), loadMore: $('load-more'), bankCount: $('bank-count'), live: $('live'),
      backdrop: $('sheet-backdrop'), sheet: $('sheet'), sheetScroll: $('sheet-scroll'),
      sheetTitle: $('sheet-title'), sheetBody: $('sheet-body'), sheetClose: $('sheet-close'),
    });
    $('date').textContent = 'THE CURIOSITY COLLECTION';
    initTheme();
    els.theme.addEventListener('click', toggleTheme);
    els.search.addEventListener('input', filterTopics);
    els.category.addEventListener('change', filterTopics);
    els.savedFilter.addEventListener('click', () => {
      state.savedOnly = !state.savedOnly;
      els.savedFilter.setAttribute('aria-pressed', String(state.savedOnly));
      filterTopics();
    });
    els.loadMore.addEventListener('click', appendBatch);
    els.refresh.addEventListener('click', () => {
      if (!state.filtered.length) return;
      const topic = state.filtered[Math.floor(Math.random() * state.filtered.length)];
      const index = state.filtered.indexOf(topic);
      while (state.rendered <= index) appendBatch();
      const entry = [...els.feed.children].find(n => n.dataset.topicId === String(topic.id));
      entry.scrollIntoView({ behavior: reduceMotion() ? 'instant' : 'smooth', block: 'center' });
      entry.querySelector('.save-topic').focus({ preventScroll: true });
    });
    els.backdrop.addEventListener('click', () => closeSheet());
    els.sheetClose.addEventListener('click', () => closeSheet());
    document.addEventListener('keydown', onKeydown);
    try {
      state.topics = (await loadTopics() || []).filter(isValidTopic).filter(t => ressourceCount(t) > 0);
      if (!state.topics.length) throw new Error('No publishable topics');
      [...new Set(state.topics.map(t => t.category).filter(Boolean))].sort().forEach(category => els.category.append(el('option', { value: category, text: category })));
      filterTopics();
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(entries => {
          if (entries.some(e => e.isIntersecting) && state.rendered < state.filtered.length) appendBatch();
        }, { rootMargin: '400px' }).observe($('feed-sentinel'));
      }
    } catch (err) {
      console.error(err);
      els.status.textContent = 'The collection could not load. Check your connection and reload to try again.';
    }
    document.body.classList.add('is-ready');
    registerServiceWorker();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();