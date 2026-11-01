import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createServiceEntry, getServiceEntry } from '@/lib/data/entries'
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

import { deleteServiceEntryAction, updateServiceEntryAction } from './actions'

const ID1 = '0192f3a0-0000-7000-8000-000000000011'
const ID2 = '0192f3a0-0000-7000-8000-000000000012'
const ID3 = '0192f3a0-0000-7000-8000-000000000013'

const update = (over: Record<string, unknown> = {}) => ({
  date: '2026-02-01T10:00:00.000Z',
  odometer: 1500,
  category: 'BRAKES',
  totalKop: 120000,
  garage: '',
  notes: '',
  ...over,
})

let a: { id: string }
let b: { id: string }

async function seed(userId: string, vehicleId: string, id: string, date: string, odometer: number) {
  await createServiceEntry(userId, {
    id,
    vehicleId,
    date: new Date(date),
    odometer,
    category: 'OIL_CHANGE',
    totalKop: 100000,
    garage: null,
    notes: null,
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
  await seed(a.id, v.id, ID1, '2026-01-01T10:00:00Z', 1000)
  await seed(a.id, v.id, ID2, '2026-02-01T10:00:00Z', 1400)
  await seed(a.id, v.id, ID3, '2026-03-01T10:00:00Z', 2000)
})

describe('updateServiceEntryAction', () => {
  it('updates and redirects to the list', async () => {
    await expect(updateServiceEntryAction(ID2, update())).rejects.toThrow('NEXT_REDIRECT:/service')
    const e = await getServiceEntry(a.id, ID2)
    expect(e?.odometer).toBe(1500)
    expect(e?.category).toBe('BRAKES')
  })

  it('returns ODOMETER_OUT_OF_RANGE with min and max', async () => {
    const res = await updateServiceEntryAction(ID2, update({ odometer: 5000 }))
    expect(res).toMatchObject({ ok: false, error: 'ODOMETER_OUT_OF_RANGE', min: 1000, max: 2000 })
  })

  it('returns NOT_FOUND for a foreign entry', async () => {
    requireUser.mockResolvedValue({ id: b.id, email: 'b@x', name: 'B' })
    expect(await updateServiceEntryAction(ID2, update())).toEqual({ ok: false, error: 'NOT_FOUND' })
    expect((await getServiceEntry(a.id, ID2))?.odometer).toBe(1400)
  })

  it('returns VALIDATION for invalid input', async () => {
    const res = await updateServiceEntryAction(ID2, update({ category: 'NOPE' }))
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toBe('VALIDATION')
  })
})

describe('deleteServiceEntryAction', () => {
  it('deletes an owned entry and redirects', async () => {
    await expect(deleteServiceEntryAction(ID2)).rejects.toThrow('NEXT_REDIRECT:/service')
    expect(await getServiceEntry(a.id, ID2)).toBeNull()
  })

  it('does not delete a foreign entry', async () => {
    requireUser.mockResolvedValue({ id: b.id, email: 'b@x', name: 'B' })
    expect(await deleteServiceEntryAction(ID2)).toEqual({ ok: false, error: 'NOT_FOUND' })
    expect(await getServiceEntry(a.id, ID2)).not.toBeNull()
  })
})

describe('updateServiceEntryAction date preservation', () => {
  it('keeps the exact stored timestamp when the date input is unchanged', async () => {
    const exact = new Date('2026-02-01T10:00:37.123Z')
    const { db } = await import('@/db/client')
    const { serviceEntry } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')
    await db.update(serviceEntry).set({ date: exact }).where(eq(serviceEntry.id, ID2))
    const { toKyivLocalInput } = await import('@/lib/domain/dates')
    await expect(
      updateServiceEntryAction(ID2, update({ date: '2026-02-01T10:00:00.000Z', dateInput: toKyivLocalInput(exact), odometer: 1450 })),
    ).rejects.toThrow('NEXT_REDIRECT')
    const e = await getServiceEntry(a.id, ID2)
    expect(e?.odometer).toBe(1450)
    expect(e?.date.toISOString()).toBe(exact.toISOString())
  })
})
