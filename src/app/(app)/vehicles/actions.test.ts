import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTestUser, resetDb } from '@/lib/data/test-utils'
import { createVehicle, getVehicle, listVehicles } from '@/lib/data/vehicles'
import type { VehicleInput } from '@/lib/domain/schemas'

let cookieValue: string | undefined
const setCookie = vi.fn()
const deleteCookie = vi.fn()
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: () => (cookieValue ? { value: cookieValue } : undefined),
    set: setCookie,
    delete: deleteCookie,
  }),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  },
}))
const requireUser = vi.fn()
vi.mock('@/lib/auth/session', () => ({ requireUser: () => requireUser() }))

import {
  createVehicleAction,
  deleteVehicleAction,
  setArchivedAction,
  updateVehicleAction,
} from './actions'

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
  setCookie.mockClear()
  deleteCookie.mockClear()
  await resetDb()
  a = await createTestUser()
  b = await createTestUser()
  requireUser.mockResolvedValue({ id: a.id, email: 'a@x', name: 'A' })
})

describe('createVehicleAction', () => {
  it('returns field errors and creates nothing for invalid input', async () => {
    const res = await createVehicleAction({ ...input('X'), name: '', year: 1900 })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(Object.keys(res.fieldErrors ?? {})).toEqual(expect.arrayContaining(['name', 'year']))
    expect(await listVehicles(a.id)).toHaveLength(0)
  })

  it('creates, redirects, and sets the cookie only for the first vehicle', async () => {
    await expect(createVehicleAction(input('First'))).rejects.toThrow('NEXT_REDIRECT:/vehicles')
    const [first] = await listVehicles(a.id)
    expect(setCookie).toHaveBeenCalledTimes(1)
    expect(setCookie.mock.calls[0][1]).toBe(first.id)

    setCookie.mockClear()
    await expect(createVehicleAction(input('Second'))).rejects.toThrow('NEXT_REDIRECT')
    expect(await listVehicles(a.id)).toHaveLength(2)
    expect(setCookie).not.toHaveBeenCalled()
  })
})

describe('updateVehicleAction', () => {
  it('does not change a foreign vehicle', async () => {
    const foreign = await createVehicle(b.id, input('Theirs'))
    const res = await updateVehicleAction(foreign.id, input('Hacked'))
    expect(res.ok).toBe(false)
    expect((await getVehicle(b.id, foreign.id))?.name).toBe('Theirs')
  })

  it('updates an owned vehicle', async () => {
    const mine = await createVehicle(a.id, input('Mine'))
    await expect(updateVehicleAction(mine.id, input('Renamed'))).rejects.toThrow('NEXT_REDIRECT')
    expect((await getVehicle(a.id, mine.id))?.name).toBe('Renamed')
  })
})

describe('setArchivedAction', () => {
  it('refuses a foreign vehicle', async () => {
    const foreign = await createVehicle(b.id, input('Theirs'))
    expect((await setArchivedAction(foreign.id, true)).ok).toBe(false)
    expect((await getVehicle(b.id, foreign.id))?.archivedAt).toBeNull()
  })
})

describe('deleteVehicleAction', () => {
  it('refuses a wrong name', async () => {
    const v = await createVehicle(a.id, input('Golf'))
    const res = await deleteVehicleAction(v.id, 'golf')
    expect(res.ok).toBe(false)
    expect(await getVehicle(a.id, v.id)).not.toBeNull()
  })

  it('deletes with the exact name (trimmed) and clears the cookie when selected', async () => {
    const v = await createVehicle(a.id, input('Golf'))
    cookieValue = v.id
    await expect(deleteVehicleAction(v.id, ' Golf ')).rejects.toThrow('NEXT_REDIRECT:/vehicles')
    expect(await getVehicle(a.id, v.id)).toBeNull()
    expect(deleteCookie).toHaveBeenCalledWith('vehicleId')
  })

  it('leaves the cookie when another vehicle was selected', async () => {
    const v = await createVehicle(a.id, input('Golf'))
    const other = await createVehicle(a.id, input('Octavia'))
    cookieValue = other.id
    await expect(deleteVehicleAction(v.id, 'Golf')).rejects.toThrow('NEXT_REDIRECT')
    expect(deleteCookie).not.toHaveBeenCalled()
  })

  it('refuses a foreign vehicle', async () => {
    const foreign = await createVehicle(b.id, input('Theirs'))
    expect((await deleteVehicleAction(foreign.id, 'Theirs')).ok).toBe(false)
    expect(await getVehicle(b.id, foreign.id)).not.toBeNull()
  })
})
