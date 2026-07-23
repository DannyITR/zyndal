const CACHE_VERSION = 'v1'
const SHELL_CACHE = `zyndal-shell-${CACHE_VERSION}`
const RUNTIME_CACHE = `zyndal-runtime-${CACHE_VERSION}`

// Unhashed, known-at-build-time paths — the app's install-time app shell.
// Hashed JS/CSS bundles can't be listed here (their filenames only exist
// after a Vite build), so they're cached opportunistically on first fetch by
// the cache-first handler below instead.
const APP_SHELL_URLS = [
  '/',
  '/manifest.json',
  '/offline.html',
  '/favicon.svg',
  '/icons/icon-72.png',
  '/icons/icon-96.png',
  '/icons/icon-128.png',
  '/icons/icon-144.png',
  '/icons/icon-152.png',
  '/icons/icon-192.png',
  '/icons/icon-384.png',
  '/icons/icon-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL_URLS))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== SHELL_CACHE && key !== RUNTIME_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  )
})

function isApiRequest(url) {
  return url.hostname.includes('supabase.co') || url.hostname.includes('anthropic.com')
}

function isStaticAsset(url) {
  const sameOriginStatic = url.origin === self.location.origin && /\.(?:js|css|woff2?|ttf|otf|svg|png|jpg|jpeg|webp|ico)$/.test(url.pathname)
  const googleFont = url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')
  return sameOriginStatic || googleFont
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // Network first: API calls should always prefer fresh data. Only fall back
  // to a cached response (if one exists from a previous successful call)
  // when the network is unreachable, e.g. offline.
  if (isApiRequest(url)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy))
          return response
        })
        .catch(() => caches.match(request))
    )
    return
  }

  // Cache first: static assets (fonts, icons, hashed JS/CSS bundles) rarely
  // change content under a given URL, so serving from cache is both instant
  // and safe. A cache miss (e.g. first visit) falls through to the network
  // and populates the cache for next time.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const copy = response.clone()
            caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy))
            return response
          })
      )
    )
    return
  }

  // Page navigations: network first so the student always gets the latest
  // build when online, falling back to the cached shell (or the offline
  // page as a last resort) when there's no connection.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(SHELL_CACHE).then((cache) => cache.put('/', copy))
          return response
        })
        .catch(() => caches.match('/').then((cached) => cached || caches.match('/offline.html')))
    )
    return
  }

  event.respondWith(caches.match(request).then((cached) => cached || fetch(request)))
})
