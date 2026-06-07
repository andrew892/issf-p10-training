const CACHE = 'p10-v15';
// Only truly static assets — never cache PHP pages (dynamic, session-dependent)
const STATIC = [
    '/assets/css/style.css',
    '/assets/js/app.js',
    '/assets/js/timer.js',
    '/assets/js/competition.js',
    '/assets/js/report.js',
    '/assets/js/target.js',
    '/assets/icons/icon-192.png',
    '/assets/icons/icon-512.png',
    '/manifest.json',
];

self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', e => {
    const url = new URL(e.request.url);
    // Network-only: PHP pages (dynamic, carry session state) and API calls
    if (url.pathname.endsWith('.php') || url.pathname.startsWith('/api/') || url.pathname === '/') {
        e.respondWith(
            fetch(e.request).catch(() =>
                url.pathname.startsWith('/api/')
                    ? new Response(JSON.stringify({ ok: false, error: 'Offline' }), {
                          headers: { 'Content-Type': 'application/json' }
                      })
                    : new Response('Offline', { status: 503 })
            )
        );
        return;
    }
    // Cache-first only for static assets (CSS, JS, icons)
    e.respondWith(
        caches.match(e.request).then(cached => {
            if (cached) return cached;
            return fetch(e.request).then(res => {
                if (res.ok && e.request.method === 'GET') {
                    caches.open(CACHE).then(c => c.put(e.request, res.clone()));
                }
                return res;
            });
        })
    );
});
