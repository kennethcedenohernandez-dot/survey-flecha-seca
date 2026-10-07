/* Survey Flecha Seca: keeps the app on the phone so it opens without internet. */
const CACHE = 'sfs-v1';
const ASSETS = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'];
const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Barlow+Condensed:wght@600;700&display=swap';
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

async function cacheFonts(cache) {
  try {
    const res = await fetch(FONT_CSS);
    if (!res.ok) return;
    const css = await res.clone().text();
    await cache.put(FONT_CSS, res);
    const urls = Array.from(css.matchAll(/url\((https:[^)]+)\)/g)).map((m) => m[1]);
    await Promise.all(urls.map((u) => fetch(u).then((r) => (r.ok ? cache.put(u, r) : null)).catch(() => null)));
  } catch (e) { /* fonts are optional: the app falls back to the phone's own font */ }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS).then(() => { cacheFonts(cache); })).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(caches.open(CACHE).then((cache) => cache.match(req.url, { ignoreVary: true }).then((hit) => hit || fetch(req).then((res) => {
      if (res && (res.ok || res.type === 'opaque')) cache.put(req.url, res.clone());
      return res;
    }))));
    return;
  }
  if (url.origin !== self.location.origin) return;
  /* App files: answer from the phone at once, and refresh the saved copy in the background when there is wifi. */
  event.respondWith(caches.open(CACHE).then((cache) => cache.match(req, { ignoreSearch: true }).then((hit) => {
    const fresh = fetch(req).then((res) => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    });
    if (hit) { fresh.catch(() => null); return hit; }
    return fresh.catch(() => (req.mode === 'navigate' ? cache.match('index.html') : Response.error()));
  })));
});
