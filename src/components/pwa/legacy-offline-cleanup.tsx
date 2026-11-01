'use client'

import { useEffect } from 'react'

// Resolves to the number of entries still queued in the old offline outbox (0 if the store is missing).
function legacyOutboxCount(db: IDBDatabase): Promise<number> {
  if (!db.objectStoreNames.contains('outbox')) return Promise.resolve(0)
  return new Promise((resolve, reject) => {
    const req = db.transaction('outbox').objectStore('outbox').count()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function removeLegacyDb() {
  if (!(await indexedDB.databases?.())?.some((d) => d.name === 'carify')) return
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open('carify')
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  const pending = await legacyOutboxCount(db).finally(() => db.close())
  // Never drop entries that were saved offline but not synced.
  if (pending > 0) {
    console.warn(`Carify: ${pending} unsynced offline entries kept in IndexedDB "carify"`)
    return
  }
  indexedDB.deleteDatabase('carify')
}

// Earlier builds shipped a service worker, `carify-*` caches and a `carify` IndexedDB for offline use.
// Remove them from devices that still have them. Safe to delete this component once old installs are gone.
export function LegacyOfflineCleanup() {
  useEffect(() => {
    void (async () => {
      try {
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations()
          await Promise.all(regs.map((r) => r.unregister()))
        }
        if ('caches' in window) {
          const keys = await caches.keys()
          await Promise.all(keys.filter((k) => k.startsWith('carify-')).map((k) => caches.delete(k)))
        }
        await removeLegacyDb()
      } catch {
        // best-effort
      }
    })()
  }, [])
  return null
}
