const LOCALE = 'uk-UA'

export function formatNumber(n: number, fractionDigits: number): string {
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(n)
}

export function formatUah(kop: number): string {
  return `${formatNumber(kop / 100, 2)} ₴`
}

export function formatKm(km: number): string {
  return `${formatNumber(km, 0)} km`
}

export function formatConsumption(lPer100: number): string {
  return `${formatNumber(lPer100, 1)} L/100km`
}

export function parseDecimal(input: string): number | null {
  const s = input.replace(/\s/g, '').replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(s)) return null
  return Number(s)
}

export function uahToKop(uah: number): number {
  return Math.round(uah * 100)
}
