/**
 * Keeps the game playable offline.
 *
 * - The page itself: from the network when there is one, so a new version shows up at once,
 *   and from the cache when there is none.
 * - Built files: their names change with their contents, so a cached copy is always right.
 * - Fonts: from the cache at once, refreshed in the background.
 *
 * The build stamps a version into CACHE (see vite.config.js); a new version clears the files
 * of the old one.
 */
const CACHE = 'suloop-__BUILD__';
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (request.mode === 'navigate') event.respondWith(pageFirstFromNetwork(request));
  else if (url.origin === location.origin) event.respondWith(fromCacheFirst(request));
  else if (FONT_HOSTS.includes(url.hostname)) event.respondWith(fromCacheThenRefresh(request));
  // Anything else (e.g. a leaderboard service) goes to the network untouched.
});

/** The page, and every file it and its scripts load, so the first visit already works offline. */
async function precache() {
  const cache = await caches.open(CACHE);
  const page = await fetch('./', { cache: 'reload' });
  if (!page.ok) return;
  await cache.put('./', page.clone());

  const files = new Set(['manifest.webmanifest', 'favicon.svg', 'icons/icon-192.png']);
  const html = await page.text();
  for (const [, path] of html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)) files.add(path);
  // Scripts can load more scripts, like the worker that counts the fewest moves.
  for (const path of [...files].filter((file) => file.endsWith('.js'))) {
    const script = await fetch(path).then((response) => (response.ok ? response.text() : ''));
    // Built scripts sit together, so a name they mention is next to them.
    for (const [, name] of script.matchAll(/assets\/([\w.-]+\.js)/g)) {
      // Firebase loads only once a player signs in, and is large: it is cached when used.
      if (name.startsWith('firebase-')) continue;
      files.add(new URL(name, new URL(path, location.href)).pathname);
    }
  }
  await cache.addAll([...files]);
}

async function pageFirstFromNetwork(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put('./', response.clone());
    return response;
  } catch {
    return (await cache.match('./')) ?? Response.error();
  }
}

async function fromCacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function fromCacheThenRefresh(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const refresh = fetch(request)
    .then((response) => {
      if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached ?? refresh;
}
