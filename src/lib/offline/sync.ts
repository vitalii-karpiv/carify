import { odometerRangeMessage } from '@/lib/domain/messages'
import { openOfflineDb } from './db'
import { listOutbox, notifyOutbox, type OutboxError, type OutboxItem } from './outbox'
import { refreshSnapshot } from './snapshot'

export function backoffDelayFor(items: { status: string; nextAttemptAt: number }[], now: number, capMs = 600000): number | null {
  const times = items.filter((i) => i.status === 'pending' && i.nextAttemptAt > now).map((i) => i.nextAttemptAt)
  if (times.length === 0) return null
  return Math.min(Math.min(...times) - now, capMs)
}

export type SyncResult = { sent: number; failed: number; pending: number; needsAuth: boolean }

export function backoffMs(attempts: number): number {
  return Math.min(5000 * 2 ** (attempts - 1), 600000)
}

const PATHS = { fuel: '/api/fuel-entries', service: '/api/service-entries' } as const

async function toOutboxError(res: Response): Promise<OutboxError> {
  const body = (await res.json().catch(() => ({}))) as {
    error?: string
    min?: number | null
    max?: number | null
  }
  if (res.status === 404 && body.error === 'VEHICLE_NOT_FOUND') {
    return { code: 'VEHICLE_NOT_FOUND', message: 'Vehicle no longer exists' }
  }
  if (res.status === 409 && body.error === 'ID_CONFLICT') {
    return { code: 'ID_CONFLICT', message: 'Entry ID already used' }
  }
  if (res.status === 422 && body.error === 'ODOMETER_OUT_OF_RANGE') {
    const min = body.min ?? null
    const max = body.max ?? null
    return { code: 'ODOMETER_OUT_OF_RANGE', message: odometerRangeMessage(min, max), min, max }
  }
  if (res.status === 422 && body.error === 'VALIDATION') {
    return { code: 'VALIDATION', message: 'Invalid entry' }
  }
  return { code: 'UNKNOWN', message: `Unexpected response (${res.status})` }
}

let running: Promise<SyncResult> | null = null
let rerun = false

export function syncOutbox(
  deps: { fetchFn?: typeof fetch; now?: () => number } = {},
): Promise<SyncResult> {
  if (running) {
    // Items enqueued mid-pass are picked up by one more pass of the running sync.
    rerun = true
    return running
  }
  running = run(deps).finally(() => {
    running = null
  })
  return running
}

async function run({
  fetchFn = globalThis.fetch,
  now = Date.now,
}: {
  fetchFn?: typeof fetch
  now?: () => number
}): Promise<SyncResult> {
  const db = await openOfflineDb()
  let sent = 0
  let failed = 0
  let needsAuth = false
  let touched = false

  do {
    rerun = false
    const items = (await listOutbox()).filter((i) => i.status === 'pending' && i.nextAttemptAt <= now())
    if (items.length > 0) touched = true
    for (const item of items) {
      let res: Response
      try {
        res = await fetchFn(PATHS[item.kind], {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item.payload),
        })
      } catch {
        await backoff(item, now())
        break
      }
      if (res.status === 200 || res.status === 201) {
        await db.delete('outbox', item.id)
        sent++
      } else if (res.status === 401) {
        needsAuth = true
        break
      } else if (res.status >= 500 || res.status === 408 || res.status === 429) {
        await backoff(item, now())
        break
      } else {
        await db.put('outbox', { ...item, status: 'failed', error: await toOutboxError(res) })
        failed++
      }
    }
  } while (rerun && !needsAuth)

  if (sent > 0) {
    try {
      await refreshSnapshot(fetchFn)
    } catch {
      // snapshot refresh is best-effort
    }
  }
  if (touched) notifyOutbox()

  const pending = (await listOutbox()).filter((i) => i.status === 'pending').length
  return { sent, failed, pending, needsAuth }

  async function backoff(item: OutboxItem, at: number) {
    const attempts = item.attempts + 1
    await db.put('outbox', { ...item, attempts, nextAttemptAt: at + backoffMs(attempts) })
  }
}
