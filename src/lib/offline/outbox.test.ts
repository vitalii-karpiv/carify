import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { __resetOfflineDbForTests, openOfflineDb } from './db'
import { discard, enqueue, listOutbox, retry, subscribeOutbox } from './outbox'
import {
  bumpLastOdometer,
  getLastUsedVehicleId,
  getSnapshotVehicles,
  refreshSnapshot,
  setLastUsedVehicleId,
} from './snapshot'

beforeEach(async () => {
  await __resetOfflineDbForTests()
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('carify')
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
})

const v = (id: string, lastOdometer: number | null = null) => ({
  id,
  name: id,
  defaultGrade: 'A95' as const,
  lastOdometer,
})

describe('outbox', () => {
  it('enqueue stores a pending item and notifies subscribers', async () => {
    const cb = vi.fn()
    const unsub = subscribeOutbox(cb)
    await enqueue('fuel', { id: 'a', odometer: 5 })
    const items = await listOutbox()
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ id: 'a', kind: 'fuel', status: 'pending', attempts: 0 })
    expect(cb).toHaveBeenCalledTimes(1)
    unsub()
    await discard('a')
    expect(cb).toHaveBeenCalledTimes(1)
    expect(await listOutbox()).toHaveLength(0)
  })

  it('lists by createdAt ascending', async () => {
    const now = vi.spyOn(Date, 'now')
    now.mockReturnValue(2000)
    await enqueue('fuel', { id: 'late' })
    now.mockReturnValue(1000)
    await enqueue('fuel', { id: 'early' })
    now.mockRestore()
    expect((await listOutbox()).map((i) => i.id)).toEqual(['early', 'late'])
  })

  it('retry resets a failed item with a new payload', async () => {
    await enqueue('fuel', { id: 'a', odometer: 1 })
    const { openOfflineDb } = await import('./db')
    const db = await openOfflineDb()
    const item = (await db.get('outbox', 'a'))!
    await db.put('outbox', {
      ...item,
      status: 'failed',
      attempts: 3,
      error: { code: 'UNKNOWN', message: 'x' },
    })
    await retry('a', { id: 'a', odometer: 2 })
    const [after] = await listOutbox()
    expect(after.status).toBe('pending')
    expect(after.attempts).toBe(0)
    expect(after.error).toBeUndefined()
    expect(after.payload).toEqual({ id: 'a', odometer: 2 })
  })
})

describe('db', () => {
  it('does not cache a failed open', async () => {
    const spy = vi.spyOn(indexedDB, 'open').mockImplementationOnce(() => {
      throw new Error('boom')
    })
    await expect(openOfflineDb()).rejects.toThrow('boom')
    spy.mockRestore()
    const db = await openOfflineDb()
    expect(db.name).toBe('carify')
  })
})

describe('snapshot', () => {
  it('invalid 200 body leaves the store untouched', async () => {
    await refreshSnapshot((async () => Response.json({ vehicles: [v('a')] })) as unknown as typeof fetch)
    await refreshSnapshot((async () => Response.json({ nope: 1 })) as unknown as typeof fetch)
    expect((await getSnapshotVehicles()).map((x) => x.id)).toEqual(['a'])
  })

  it('refreshSnapshot replaces the store on 200 and ignores other statuses', async () => {
    const ok = (vehicles: unknown[]) =>
      (async () => Response.json({ vehicles })) as unknown as typeof fetch
    await refreshSnapshot(ok([v('a'), v('b')]))
    expect((await getSnapshotVehicles()).map((x) => x.id).sort()).toEqual(['a', 'b'])
    await refreshSnapshot(ok([v('c')]))
    expect((await getSnapshotVehicles()).map((x) => x.id)).toEqual(['c'])
    await refreshSnapshot((async () => new Response('', { status: 401 })) as unknown as typeof fetch)
    expect((await getSnapshotVehicles()).map((x) => x.id)).toEqual(['c'])
  })

  it('bumpLastOdometer keeps the max', async () => {
    await refreshSnapshot((async () => Response.json({ vehicles: [v('a', 100)] })) as unknown as typeof fetch)
    await bumpLastOdometer('a', 50)
    expect((await getSnapshotVehicles())[0].lastOdometer).toBe(100)
    await bumpLastOdometer('a', 300)
    expect((await getSnapshotVehicles())[0].lastOdometer).toBe(300)
    await bumpLastOdometer('missing', 1)
  })

  it('bumpLastOdometer sets when existing is null', async () => {
    await refreshSnapshot((async () => Response.json({ vehicles: [v('a', null)] })) as unknown as typeof fetch)
    await bumpLastOdometer('a', 10)
    expect((await getSnapshotVehicles())[0].lastOdometer).toBe(10)
  })

  it('stores last used vehicle id', async () => {
    expect(await getLastUsedVehicleId()).toBeNull()
    await setLastUsedVehicleId('a')
    expect(await getLastUsedVehicleId()).toBe('a')
  })
})
