import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTestUser, resetDb } from '@/lib/data/test-utils'
import { createVehicle, setVehicleArchived } from '@/lib/data/vehicles'
import type { VehicleInput } from '@/lib/domain/schemas'

let cookieValue: string | undefined
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => (cookieValue ? { value: cookieValue } : undefined) }),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth/session', () => ({ requireUser: vi.fn() }))

import { getSelectedVehicle } from './vehicle-selection'

const input = (name: string): VehicleInput => ({
  name,
  make: 'VW',
  model: 'Golf',
  year: 2020,
  plate: 'AA0001AA',
  vin: null,
  defaultGrade: 'A95',
})

let a: { id: string }
let b: { id: string }

beforeEach(async () => {
  cookieValue = undefined
  await resetDb()
  a = await createTestUser()
  b = await createTestUser()
})

describe('getSelectedVehicle', () => {
  it('returns the cookie vehicle when owned and active', async () => {
    await createVehicle(a.id, input('First'))
    const second = await createVehicle(a.id, input('Second'))
    cookieValue = second.id
    expect((await getSelectedVehicle(a.id))?.id).toBe(second.id)
  })

  it("falls back to own first vehicle when cookie names another user's vehicle", async () => {
    const mine = await createVehicle(a.id, input('Mine'))
    const theirs = await createVehicle(b.id, input('Theirs'))
    cookieValue = theirs.id
    expect((await getSelectedVehicle(a.id))?.id).toBe(mine.id)
  })

  it('falls back when the cookie vehicle is archived', async () => {
    const first = await createVehicle(a.id, input('First'))
    const second = await createVehicle(a.id, input('Second'))
    await setVehicleArchived(a.id, second.id, true)
    cookieValue = second.id
    expect((await getSelectedVehicle(a.id))?.id).toBe(first.id)
  })

  it('falls back on a malformed cookie and uses first vehicle with no cookie', async () => {
    const first = await createVehicle(a.id, input('First'))
    cookieValue = 'not-a-uuid'
    expect((await getSelectedVehicle(a.id))?.id).toBe(first.id)
    cookieValue = undefined
    expect((await getSelectedVehicle(a.id))?.id).toBe(first.id)
  })

  it('returns null when the user has no active vehicles', async () => {
    expect(await getSelectedVehicle(a.id)).toBeNull()
    const v = await createVehicle(a.id, input('Only'))
    await setVehicleArchived(a.id, v.id, true)
    expect(await getSelectedVehicle(a.id)).toBeNull()
  })
})
