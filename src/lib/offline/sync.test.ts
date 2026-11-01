import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { __resetOfflineDbForTests } from './db'
import { enqueue, listOutbox } from './outbox'
import { backoffMs, syncOutbox } from './sync'

beforeEach(async () => {
  await __resetOfflineDbForTests()
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('carify')
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
})

type Responder = (url: string, init: RequestInit) => Response | Promise<Response>
function stub(responder: Responder) {
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url === '/api/offline-snapshot') return Response.json({ vehicles: [] })
    return responder(url, init ?? {})
  })
  return fn as unknown as typeof fetch & ReturnType<typeof vi.fn>
}
const entryCalls = (fn: ReturnType<typeof vi.fn>) =>
  fn.mock.calls.filter((c) => String(c[0]) !== '/api/offline-snapshot')
const norm = (s?: string) => s?.replace(/\s/g, ' ')
const json = (body: unknown, status: number) => Response.json(body, { status })

describe('backoffMs', () => {
  it('doubles and caps', () => {
    expect(backoffMs(1)).toBe(5000)
    expect(backoffMs(2)).toBe(10000)
    expect(backoffMs(20)).toBe(600000)
  })
})

describe('syncOutbox', () => {
  it('201 removes the item; request shape is correct', async () => {
    await enqueue('fuel', { id: 'a', odometer: 5 })
    const fetchFn = stub(() => json({ ok: true }, 201))
    const res = await syncOutbox({ fetchFn })
    expect(res).toEqual({ sent: 1, failed: 0, pending: 0, needsAuth: false })
    expect(await listOutbox()).toHaveLength(0)
    const [url, init] = entryCalls(fetchFn)[0]
    expect(url).toBe('/api/fuel-entries')
    expect(init.method).toBe('POST')
    expect(init.credentials).toBe('same-origin')
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' })
    expect(JSON.parse(init.body as string)).toEqual({ id: 'a', odometer: 5 })
  })

  it('service entries go to /api/service-entries', async () => {
    await enqueue('service', { id: 's' })
    const fetchFn = stub(() => json({ ok: true }, 201))
    await syncOutbox({ fetchFn })
    expect(String(entryCalls(fetchFn)[0][0])).toBe('/api/service-entries')
  })

  it('200 duplicate removes and counts as sent', async () => {
    await enqueue('fuel', { id: 'a' })
    const res = await syncOutbox({ fetchFn: stub(() => json({ ok: true, duplicate: true }, 200)) })
    expect(res.sent).toBe(1)
    expect(await listOutbox()).toHaveLength(0)
  })

  it('404 -> VEHICLE_NOT_FOUND failed', async () => {
    await enqueue('fuel', { id: 'a' })
    const res = await syncOutbox({ fetchFn: stub(() => json({ error: 'VEHICLE_NOT_FOUND' }, 404)) })
    expect(res).toMatchObject({ sent: 0, failed: 1, pending: 0 })
    const [item] = await listOutbox()
    expect(item.status).toBe('failed')
    expect(item.error).toEqual({ code: 'VEHICLE_NOT_FOUND', message: 'Vehicle no longer exists' })
  })

  it('409 -> ID_CONFLICT', async () => {
    await enqueue('fuel', { id: 'a' })
    await syncOutbox({ fetchFn: stub(() => json({ error: 'ID_CONFLICT' }, 409)) })
    expect((await listOutbox())[0].error).toEqual({ code: 'ID_CONFLICT', message: 'Entry ID already used' })
  })

  it('422 odometer -> ODOMETER_OUT_OF_RANGE with min/max', async () => {
    await enqueue('fuel', { id: 'a' })
    await syncOutbox({
      fetchFn: stub(() => json({ error: 'ODOMETER_OUT_OF_RANGE', min: 1000, max: 2000 }, 422)),
    })
    const error = (await listOutbox())[0].error!
    expect(norm(error.message)).toBe('Odometer must be between 1 000 and 2 000 km')
    expect(error).toMatchObject({ code: 'ODOMETER_OUT_OF_RANGE', min: 1000, max: 2000 })
  })

  it('422 odometer with one-sided range', async () => {
    await enqueue('fuel', { id: 'a' })
    await enqueue('fuel', { id: 'b' })
    let n = 0
    await syncOutbox({
      fetchFn: stub(() =>
        n++ === 0
          ? json({ error: 'ODOMETER_OUT_OF_RANGE', min: 1000, max: null }, 422)
          : json({ error: 'ODOMETER_OUT_OF_RANGE', min: null, max: 2000 }, 422),
      ),
    })
    const items = await listOutbox()
    expect(norm(items[0].error?.message)).toBe('Odometer must be at least 1 000 km')
    expect(norm(items[1].error?.message)).toBe('Odometer must be at most 2 000 km')
  })

  it('422 VALIDATION and unknown 4xx', async () => {
    await enqueue('fuel', { id: 'a' })
    await enqueue('fuel', { id: 'b' })
    let n = 0
    await syncOutbox({
      fetchFn: stub(() => (n++ === 0 ? json({ error: 'VALIDATION', issues: [] }, 422) : json({}, 400))),
    })
    const items = await listOutbox()
    expect(items[0].error).toEqual({ code: 'VALIDATION', message: 'Invalid entry' })
    expect(items[1].error).toEqual({ code: 'UNKNOWN', message: 'Unexpected response (400)' })
  })

  it('401 stops, leaves item pending, later items not attempted', async () => {
    await enqueue('fuel', { id: 'a' })
    await enqueue('fuel', { id: 'b' })
    const fetchFn = stub(() => json({ error: 'UNAUTHENTICATED' }, 401))
    const res = await syncOutbox({ fetchFn })
    expect(res).toMatchObject({ sent: 0, needsAuth: true, pending: 2 })
    expect(entryCalls(fetchFn)).toHaveLength(1)
    const items = await listOutbox()
    expect(items.map((i) => [i.status, i.attempts])).toEqual([['pending', 0], ['pending', 0]])
  })

  it('network error backs off; second sync before nextAttemptAt sends nothing', async () => {
    await enqueue('fuel', { id: 'a' })
    const failing = stub(() => {
      throw new TypeError('offline')
    })
    const t0 = Date.now() + 100_000
    const res = await syncOutbox({ fetchFn: failing, now: () => t0 })
    expect(res).toMatchObject({ sent: 0, pending: 1 })
    const [item] = await listOutbox()
    expect(item).toMatchObject({ status: 'pending', attempts: 1, nextAttemptAt: t0 + 5000 })
    const ok = stub(() => json({ ok: true }, 201))
    await syncOutbox({ fetchFn: ok, now: () => t0 + 1000 })
    expect(entryCalls(ok)).toHaveLength(0)
    await syncOutbox({ fetchFn: ok, now: () => t0 + 5000 })
    expect(entryCalls(ok)).toHaveLength(1)
  })

  it('5xx backs off and stops the loop', async () => {
    await enqueue('fuel', { id: 'a' })
    await enqueue('fuel', { id: 'b' })
    const fetchFn = stub(() => json({}, 503))
    const t0 = Date.now() + 100_000
    await syncOutbox({ fetchFn, now: () => t0 })
    expect(entryCalls(fetchFn)).toHaveLength(1)
    const items = await listOutbox()
    expect(items[0]).toMatchObject({ attempts: 1, nextAttemptAt: t0 + 5000 })
    expect(items[1].attempts).toBe(0)
  })

  it('sends items in createdAt order', async () => {
    const now = vi.spyOn(Date, 'now')
    now.mockReturnValue(2000)
    await enqueue('fuel', { id: 'late' })
    now.mockReturnValue(1000)
    await enqueue('fuel', { id: 'early' })
    now.mockRestore()
    const order: string[] = []
    await syncOutbox({
      fetchFn: stub((_u, init) => {
        order.push(JSON.parse(init.body as string).id)
        return json({ ok: true }, 201)
      }),
    })
    expect(order).toEqual(['early', 'late'])
  })

  it('single-flight: concurrent calls share one run', async () => {
    await enqueue('fuel', { id: 'a' })
    await enqueue('fuel', { id: 'b' })
    const fetchFn = stub(() => json({ ok: true }, 201))
    const [r1, r2] = await Promise.all([syncOutbox({ fetchFn }), syncOutbox({ fetchFn })])
    expect(entryCalls(fetchFn)).toHaveLength(2)
    expect(r1).toBe(r2)
  })

  it('snapshot refresh failure does not fail the sync', async () => {
    await enqueue('fuel', { id: 'a' })
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === '/api/offline-snapshot') throw new TypeError('offline')
      return json({ ok: true }, 201)
    }) as unknown as typeof fetch
    const res = await syncOutbox({ fetchFn })
    expect(res.sent).toBe(1)
  })

  it('refreshes the snapshot once after a pass with successes', async () => {
    await enqueue('fuel', { id: 'a' })
    await enqueue('fuel', { id: 'b' })
    const fetchFn = stub(() => json({ ok: true }, 201))
    await syncOutbox({ fetchFn })
    const snaps = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c) => String(c[0]) === '/api/offline-snapshot',
    )
    expect(snaps).toHaveLength(1)
  })
})
