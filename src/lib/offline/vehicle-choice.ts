import { VEHICLE_COOKIE } from '@/lib/vehicle-cookie'

/** Reads the selected-vehicle cookie from a `document.cookie`-style string. */
export function readVehicleCookie(cookieString: string): string | null {
  for (const part of cookieString.split(';')) {
    const [name, ...rest] = part.trim().split('=')
    if (name === VEHICLE_COOKIE) return decodeURIComponent(rest.join('='))
  }
  return null
}

/** Last-used vehicle, else the cookie's vehicle, else the first — each only if it is in the list. */
export function chooseVehicleId(
  list: { id: string }[],
  lastUsedId: string | null,
  cookieId: string | null,
): string | undefined {
  for (const id of [lastUsedId, cookieId]) {
    if (id && list.some((v) => v.id === id)) return id
  }
  return list[0]?.id
}
