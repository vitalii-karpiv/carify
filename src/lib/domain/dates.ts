export const APP_TIME_ZONE = 'Europe/Kyiv'

/** 'YYYY-MM' of the instant in the given time zone. */
export function monthKey(date: Date, tz: string = APP_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date)
  const year = parts.find((p) => p.type === 'year')?.value
  const month = parts.find((p) => p.type === 'month')?.value
  return `${year}-${month}`
}

const dateFormatter = new Intl.DateTimeFormat('uk-UA', {
  timeZone: APP_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

export function formatDate(date: Date): string {
  return dateFormatter.format(date)
}

const localParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

function kyivWallClockAsUtc(date: Date): number {
  const get = (t: string) => Number(localParts.formatToParts(date).find((p) => p.type === t)?.value)
  return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'))
}

/** Value for `<input type="datetime-local">` ('YYYY-MM-DDTHH:mm') in Kyiv local time. */
export function toKyivLocalInput(date: Date): string {
  return new Date(kyivWallClockAsUtc(date)).toISOString().slice(0, 16)
}

/**
 * Inverse of `toKyivLocalInput`: interprets the value as Kyiv local time. Invalid input → Invalid Date.
 * DST policy: a nonexistent time (spring-forward gap, e.g. 2026-03-29T03:30) resolves forward, to the
 * instant after the gap (04:30 EEST = 01:30Z); an ambiguous time (fall-back overlap, e.g.
 * 2026-10-25T03:30) resolves to the later occurrence (EET, 01:30Z).
 */
export function fromKyivLocalInput(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value)
  if (!m) return new Date(NaN)
  const wall = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5])
  // offset of the zone at (approximately) that instant; refine once for DST edges
  let guess = wall - (kyivWallClockAsUtc(new Date(wall)) - wall)
  guess = wall - (kyivWallClockAsUtc(new Date(guess)) - guess)
  return new Date(guess)
}
