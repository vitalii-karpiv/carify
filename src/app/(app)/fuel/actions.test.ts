import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFuelEntry, getFuelEntry } from '@/lib/data/entries'
import { createTestUser, resetDb } from '@/lib/data/test-utils'
import { createVehicle } from '@/lib/data/vehicles'

vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  },
}))
const requireUser = vi.fn()
vi.mock('@/lib/auth/session', () => ({ requireUser: () => requireUser() }))

import { deleteFuelEntryAction, updateFuelEntryAction } from './actions'

const ID1 = '0192f3a0-0000-7000-8000-000000000001'
const ID2 = '0192f3a0-0000-7000-8000-000000000002'
const ID3 = '0192f3a0-0000-7000-8000-000000000003'

const update = (over: Record<string, unknown> = {}) => ({
  date: '2026-02-01T10:00:00.000Z',
  odometer: 1500,
  litres: 40,
  pricePerLitreKop: 5000,
  totalKop: 200000,
  grade: 'A95',
  isFull: true,
  missedPrevious: false,
  station: '',
  note: '',
  ...over,
})

let a: { id: string }
let b: { id: string }
let vehicleId: string

async function seed(userId: string, vId: string, id: string, date: string, odometer: number) {
  await createFuelEntry(userId, {
    id,
    vehicleId: vId,
    date: new Date(date),
    odometer,
    litres: 40,
    pricePerLitreKop: 5000,
    totalKop: 200000,
    grade: 'A95',
    isFull: true,
    missedPrevious: false,
    station: null,
    note: null,
  })
}

beforeEach(async () => {
  await resetDb()
  a = await createTestUser()
  b = await createTestUser()
  requireUser.mockResolvedValue({ id: a.id, email: 'a@x', name: 'A' })
  const v = await createVehicle(a.id, {
    name: 'Golf',
    make: 'VW',
    model: 'Golf',
    year: 2020,
    plate: 'AA0001AA',
    vin: null,
    defaultGrade: 'A95',
  })
  vehicleId = v.id
  await seed(a.id, vehicleId, ID1, '2026-01-01T10:00:00Z', 1000)
  await seed(a.id, vehicleId, ID2, '2026-02-01T10:00:00Z', 1400)
  await seed(a.id, vehicleId, ID3, '2026-03-01T10:00:00Z', 2000)
})

describe('updateFuelEntryAction', () => {
  it('updates and redirects to the list', async () => {
    await expect(updateFuelEntryAction(ID2, update())).rejects.toThrow('NEXT_REDIRECT:/fuel')
    expect((await getFuelEntry(a.id, ID2))?.odometer).toBe(1500)
  })

  it('returns ODOMETER_OUT_OF_RANGE with min and max', async () => {
    const res = await updateFuelEntryAction(ID2, update({ odometer: 5000 }))
    expect(res).toMatchObject({ ok: false, error: 'ODOMETER_OUT_OF_RANGE', min: 1000, max: 2000 })
    expect((await getFuelEntry(a.id, ID2))?.odometer).toBe(1400)
  })

  it('returns NOT_FOUND for a foreign entry and leaves it unchanged', async () => {
    requireUser.mockResolvedValue({ id: b.id, email: 'b@x', name: 'B' })
    const res = await updateFuelEntryAction(ID2, update())
    expect(res).toEqual({ ok: false, error: 'NOT_FOUND' })
    expect((await getFuelEntry(a.id, ID2))?.odometer).toBe(1400)
  })

  it('returns VALIDATION with TOTAL_MISMATCH on the total', async () => {
    const res = await updateFuelEntryAction(ID2, update({ totalKop: 100000 }))
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.error).toBe('VALIDATION')
      expect(res.fieldErrors?.totalKop).toContain('TOTAL_MISMATCH')
    }
  })
})

describe('deleteFuelEntryAction', () => {
  it('deletes an owned entry and redirects', async () => {
    await expect(deleteFuelEntryAction(ID2)).rejects.toThrow('NEXT_REDIRECT:/fuel')
    expect(await getFuelEntry(a.id, ID2)).toBeNull()
  })

  it('does not delete a foreign entry', async () => {
    requireUser.mockResolvedValue({ id: b.id, email: 'b@x', name: 'B' })
    expect(await deleteFuelEntryAction(ID2)).toEqual({ ok: false, error: 'NOT_FOUND' })
    expect(await getFuelEntry(a.id, ID2)).not.toBeNull()
  })
})
