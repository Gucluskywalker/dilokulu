/* Deutsch, wieder… — Service Worker
   Kabuk önceden önbelleğe alınır; içerik ve medya kullanıldıkça saklanır. */

const VERSION = 'dw-v2.0.0';
const SHELL = VERSION + '-shell';
const DATA  = VERSION + '-data';
const MEDIA = VERSION + '-media';

const SHELL_FILES = [
  './',
  './index.html',
  './app.css',
  './app.js',
  './manifest.webmanifest',
  './config.js',
  './content/catalog.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(SHELL)
      .then(c => c.addAll(SHELL_FILES))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => !k.startsWith(VERSION)).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

function bucketFor(url) {
  if (/\.(png|jpe?g|webp|mp3|m4a|wav)$/i.test(url.pathname)) return MEDIA;
  if (/\/content\//.test(url.pathname)) return DATA;
  return SHELL;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  // /api/ istekleri (giriş & senkron): önbelleğe alma, her zaman ağa git
  if (/\/api\//.test(new URL(req.url).pathname)) return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // Google Fonts ve CDN medyası: önce önbellek, sonra ağ, sonra sakla
  if (!sameOrigin) {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        if (res && (res.ok || res.type === 'opaque')) {
          const copy = res.clone();
          caches.open(MEDIA).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => hit))
    );
    return;
  }

  // Uygulama kabuğu: gezinme istekleri her zaman index.html
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).catch(() => caches.match('./index.html'))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(hit => {
      if (hit) {
        // arka planda tazele
        fetch(req).then(res => {
          if (res && res.ok) caches.open(bucketFor(url)).then(c => c.put(req, res.clone()));
        }).catch(() => {});
        return hit;
      }
      return fetch(req).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(bucketFor(url)).then(c => c.put(req, copy));
        }
        return res;
      });
    })
  );
});

self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});
