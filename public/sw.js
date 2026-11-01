/* Carify service worker (hand-written; no build step).
 * Bump VERSION on any change that must replace old precache entries. */
const VERSION = 'v1'
const PRECACHE = `carify-precache-${VERSION}`
const RUNTIME = `carify-runtime-${VERSION}`
const PAGES = ['/add', '/offline']

async function precacheAll() {
  const cache = await caches.open(PRECACHE)
  const assets = new Set()
  for (const page of PAGES) {
    const res = await fetch(page, { cache: 'reload' })
    if (!res.ok) throw new Error(`precache ${page} failed: ${res.status}`)
    const html = await res.clone().text()
    await cache.put(page, res)
    for (const m of html.matchAll(/\/_next\/static\/[^"'\\\s)]+/g)) assets.add(m[0])
  }
  await Promise.all(
    [...assets].map(async (url) => {
      try {
        const res = await fetch(url)
        if (res.ok) await cache.put(url, res)
      } catch {
        // asset will be fetched (and runtime-cached) on demand
      }
    }),
  )
}

self.addEventListener('install', (event) => {
  event.waitUntil(precacheAll().then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== PRECACHE && k !== RUNTIME).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  // Never cache or intercept API / auth responses.
  if (url.pathname.startsWith('/api/')) return

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(async () => {
        const fallback = url.pathname === '/add' || url.pathname.startsWith('/add/') ? '/add' : '/offline'
        return (await caches.match(fallback)) || Response.error()
      }),
    )
    return
  }

  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone()
              caches.open(RUNTIME).then((c) => c.put(req, copy))
            }
            return res
          }),
      ),
    )
  }
})
