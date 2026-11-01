/* Carify service worker TEMPLATE. scripts/generate-sw.mjs writes public/sw.js
 * (gitignored) on prebuild, substituting the build-derived version below. */
const VERSION = '__SW_VERSION__'
const PRECACHE = `carify-precache-${VERSION}`
const RUNTIME = `carify-runtime-${VERSION}`
const PAGES = ['/add', '/offline']

const cacheable = (res) => res.ok && !res.redirected

async function precacheAll() {
  const cache = await caches.open(PRECACHE)
  const assets = new Set()
  const stylesheets = new Set()
  for (const page of PAGES) {
    const res = await fetch(page, { cache: 'reload' })
    if (!cacheable(res)) throw new Error(`precache ${page} failed: ${res.status}`)
    const html = await res.clone().text()
    await cache.put(page, res)
    for (const m of html.matchAll(/\/_next\/static\/[^"'\\\s)]+/g)) {
      assets.add(m[0])
      if (m[0].split('?')[0].endsWith('.css')) stylesheets.add(m[0])
    }
  }
  // Fonts and other media referenced from CSS.
  for (const css of stylesheets) {
    try {
      const res = await fetch(css)
      if (!res.ok) continue
      for (const m of (await res.text()).matchAll(/\/_next\/static\/media\/[^"'\s)]+/g)) assets.add(m[0])
    } catch {
      // fonts will be runtime-cached on demand
    }
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
      fetch(req)
        .then((res) => {
          // Keep the offline copies of /add and /offline fresh.
          if (PAGES.includes(url.pathname) && cacheable(res)) {
            const copy = res.clone()
            event.waitUntil(
              caches
                .open(PRECACHE)
                .then((c) => c.put(url.pathname, copy))
                .catch(() => {}),
            )
          }
          return res
        })
        .catch(async () => {
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
              event.waitUntil(
                caches
                  .open(RUNTIME)
                  .then((c) => c.put(req, copy))
                  .catch(() => {}),
              )
            }
            return res
          }),
      ),
    )
  }
})
