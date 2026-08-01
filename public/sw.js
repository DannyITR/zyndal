const CACHE_VERSION = 'v3'
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

// Bug fix: this only ever matched supabase.co/anthropic.com — true before
// the RLS migration, when the client queried Supabase directly, but every
// data call has gone through this app's own same-origin /api/* endpoints
// since (see api/_lib/auth.js). Same-origin GET /api/* calls (e.g.
// get-daily-progress, get-progress) matched none of this function's checks
// and fell through to the generic cache-first handler at the bottom of the
// fetch listener instead — meaning the very first time a browser ever
// fetched a given /api/* GET URL, that response was cached FOREVER and
// never re-fetched, regardless of what the server started returning after
// a deploy. This is why a timezone/date-logic fix that was provably
// correct server-side could still show stale "answered today" state in an
// already-visited browser: it was reading a frozen response from before
// the fix, not live data. CACHE_VERSION was bumped alongside this change
// so any already-cached stale /api/* responses are dropped on activate,
// not just newly-fixed-routing ones going forward.
function isApiRequest(url) {
  return url.pathname.startsWith('/api/') || url.hostname.includes('supabase.co') || url.hostname.includes('anthropic.com')
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
  // build when online, falling back to a cached shell (or the offline page
  // as a last resort) when there's no connection.
  //
  // Bug fix: this used to always cache under (and fall back to) the literal
  // key '/', regardless of which path was actually being navigated to.
  // Every deep link — /auth/callback, /verify, /reset-password, /admin —
  // is a real, distinct navigation this same branch handles, since they're
  // all served by the same index.html rewrite (see vercel.json). Caching
  // them all under '/' isn't wrong by itself (they're byte-identical
  // responses), but falling back to '/' on a fetch failure could serve a
  // stale index.html from a PREVIOUS deploy — one that references JS/CSS
  // bundle filenames a new deployment no longer has, since Vite hashes
  // those per build. That combination (old shell HTML + already-gone
  // hashed assets) is exactly what produces a blank white page: the static
  // HTML loads, but its <script>/<link> tags 404, so React never mounts
  // and even index.css's splash styling never applies. OAuth's redirect
  // (Google → Supabase → here) is a real cross-origin round trip with more
  // failure surface than an in-app navigation, and it's often the first
  // navigation-type request in a while for a given device — exactly the
  // profile of a request likely to hit this fallback path while carrying a
  // stale cache. Caching/falling back under the request's own URL first
  // (keyed identically to how it was actually fetched) avoids ever mixing
  // an old shell with a URL it wasn't captured for, while '/' stays as a
  // last-resort shell if this exact URL was never cached at all.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy))
          return response
        })
        .catch(() =>
          caches
            .match(request)
            .then((cached) => cached || caches.match('/'))
            .then((cached) => cached || caches.match('/offline.html'))
        )
    )
    return
  }

  event.respondWith(caches.match(request).then((cached) => cached || fetch(request)))
})

// Web Push — see api/_lib/push.js for the server side. Payload is always
// JSON ({ title, body, url }), set by sendPushToUser.
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {}
  event.waitUntil(
    self.registration.showNotification(data.title || 'Zyndal', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: data.url || 'https://zyndal.ca' },
    })
  )
})

// Bug fix: this used to compare `client.url === url` — an exact string
// match against 'https://zyndal.ca' with no path. A client's `url` almost
// never comes back exactly that (browsers normalize the root path to a
// trailing slash, and the app can be sitting on any other in-app screen
// state), so this NEVER matched an already-open window and always fell
// through to openWindow(), reloading the whole app fresh on every tap even
// when it was already running in the foreground. Matching on origin
// instead finds any already-open Zyndal window regardless of its exact
// path, and only navigates it if its current URL actually differs from the
// notification's target — so tapping a notification while already on the
// right screen just focuses the window without losing in-memory state.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || 'https://zyndal.ca'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (list) => {
      let targetOrigin
      try {
        targetOrigin = new URL(url).origin
      } catch {
        targetOrigin = null
      }

      const existing = list.find((client) => {
        try {
          return targetOrigin && new URL(client.url).origin === targetOrigin
        } catch {
          return false
        }
      })

      if (existing) {
        if ('focus' in existing) await existing.focus()
        if ('navigate' in existing && existing.url !== url) {
          // Older/non-Chromium engines may not support WindowClient.navigate
          // — focusing the existing window is still strictly better than
          // opening a duplicate one, so a failure here is a soft no-op.
          await existing.navigate(url).catch(() => {})
        }
        return
      }

      if (self.clients.openWindow) return self.clients.openWindow(url)
    })
  )
})
