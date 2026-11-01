import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { SnapshotVehicle } from '@/lib/domain/types'
import type { OutboxItem } from './outbox'

export interface OfflineSchema extends DBSchema {
  outbox: { key: string; value: OutboxItem }
  snapshot: { key: string; value: SnapshotVehicle }
  meta: { key: string; value: unknown }
}

let dbPromise: Promise<IDBPDatabase<OfflineSchema>> | null = null

// Lazy: nothing touches `indexedDB` until first call (browser only).
export function openOfflineDb(): Promise<IDBPDatabase<OfflineSchema>> {
  dbPromise ??= openDB<OfflineSchema>('carify', 1, {
    upgrade(db) {
      db.createObjectStore('outbox', { keyPath: 'id' })
      db.createObjectStore('snapshot', { keyPath: 'id' })
      db.createObjectStore('meta')
    },
  })
  return dbPromise
}

/** Test-only: close the cached connection so the DB can be deleted. */
export async function __resetOfflineDbForTests(): Promise<void> {
  const p = dbPromise
  dbPromise = null
  if (p) (await p).close()
}
