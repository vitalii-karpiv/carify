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
