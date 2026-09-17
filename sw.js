/* Network first: refresh the collection online, retain the shell offline. */
const CACHE = 'ddd-collection-v7';
const ASSETS = ['./', './index.html', './style.css', './critical-thinking.css', './script.js', './topics.json', './topics-critical-thinking.json', './manifest.webmanifest',
  './icon/icon-192.png', './icon/icon-512.png', './icon/envelope.png', './icon/envelope-paper.png',
  './icon/paper-top.png', './icon/paper-middle.png', './icon/paper-bottom.png',
  './icon/book_icon.png', './icon/article_icon.png', './icon/video_icon.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('ddd-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    } catch {
      return await cache.match(request) || (request.mode === 'navigate' ? await cache.match('./index.html') : null) || Response.error();
    }
  })());
});