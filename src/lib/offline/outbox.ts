import { openOfflineDb } from './db'

export type OutboxKind = 'fuel' | 'service'

export type OutboxError = {
  code: 'VALIDATION' | 'ODOMETER_OUT_OF_RANGE' | 'VEHICLE_NOT_FOUND' | 'ID_CONFLICT' | 'UNKNOWN'
  message: string
  min?: number | null
  max?: number | null
}

export type OutboxItem = {
  id: string
  kind: OutboxKind
  payload: Record<string, unknown>
  status: 'pending' | 'failed'
  error?: OutboxError
  attempts: number
  createdAt: number
  nextAttemptAt: number
}

const listeners = new Set<() => void>()

export function subscribeOutbox(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

export function notifyOutbox(): void {
  for (const cb of [...listeners]) cb()
}

export async function enqueue(
  kind: OutboxKind,
  payload: { id: string } & Record<string, unknown>,
): Promise<void> {
  const db = await openOfflineDb()
  const now = Date.now()
  await db.put('outbox', {
    id: payload.id,
    kind,
    payload,
    status: 'pending',
    attempts: 0,
    createdAt: now,
    nextAttemptAt: now,
  })
  notifyOutbox()
}

export async function listOutbox(): Promise<OutboxItem[]> {
  const db = await openOfflineDb()
  const items = await db.getAll('outbox')
  return items.sort((a, b) => a.createdAt - b.createdAt)
}

export async function discard(id: string): Promise<void> {
  const db = await openOfflineDb()
  await db.delete('outbox', id)
  notifyOutbox()
}

export async function retry(id: string, payload?: Record<string, unknown>): Promise<void> {
  const db = await openOfflineDb()
  const tx = db.transaction('outbox', 'readwrite')
  const item = await tx.store.get(id)
  if (item) {
    const cleared: OutboxItem = { ...item }
    delete cleared.error
    await tx.store.put({
      ...cleared,
      payload: { ...(payload ?? item.payload), id: item.id },
      status: 'pending',
      attempts: 0,
      nextAttemptAt: Date.now(),
    })
  }
  await tx.done
  notifyOutbox()
}
