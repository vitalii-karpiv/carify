import { formatNumber } from './money'

/** 'Must be between 1 000 and 2 000 km'; omits the missing side. */
export function odometerRangeMessage(min: number | null | undefined, max: number | null | undefined): string {
  const lo = min == null ? null : formatNumber(min, 0)
  const hi = max == null ? null : formatNumber(max, 0)
  if (lo !== null && hi !== null) return `Must be between ${lo} and ${hi} km`
  if (lo !== null) return `Must be at least ${lo} km`
  if (hi !== null) return `Must be at most ${hi} km`
  return 'Invalid odometer'
}

export const TOTAL_MISMATCH_MESSAGE = 'Total does not match litres × price'
