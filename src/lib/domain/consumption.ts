export type ConsumptionEntry = {
  id: string
  date: Date
  odometer: number
  litres: number
  isFull: boolean
  missedPrevious: boolean
}

export type Segment = {
  startEntryId: string
  /** The fills whose fuel was burned in this segment: the starting full fill plus any partials before the end. */
  fuelEntryIds: string[]
  endEntryId: string
  endDate: Date
  startOdometer: number
  endOdometer: number
  km: number
  litres: number
  lPer100: number | null
  valid: boolean
}

export function computeSegments(entries: ConsumptionEntry[]): Segment[] {
  const sorted = [...entries].sort(
    (a, b) => a.date.getTime() - b.date.getTime() || a.odometer - b.odometer,
  )
  const segments: Segment[] = []
  let baseline: ConsumptionEntry | null = null
  let litres = 0
  let missed = false
  let partialIds: string[] = []

  for (const entry of sorted) {
    if (!baseline) {
      if (entry.isFull) baseline = entry
      continue
    }
    litres += entry.litres
    missed ||= entry.missedPrevious
    if (!entry.isFull) {
      partialIds.push(entry.id)
      continue
    }

    const km = entry.odometer - baseline.odometer
    const valid = !missed && km > 0
    segments.push({
      startEntryId: baseline.id,
      fuelEntryIds: [baseline.id, ...partialIds],
      endEntryId: entry.id,
      endDate: entry.date,
      startOdometer: baseline.odometer,
      endOdometer: entry.odometer,
      km,
      litres,
      lPer100: valid ? (litres * 100) / km : null,
      valid,
    })
    baseline = entry
    litres = 0
    missed = false
    partialIds = []
  }
  return segments
}

export function summarizeConsumption(segments: Segment[]): {
  lifetime: number | null
  last: number | null
} {
  const valid = segments.filter((s) => s.valid)
  if (valid.length === 0) return { lifetime: null, last: null }
  const litres = valid.reduce((sum, s) => sum + s.litres, 0)
  const km = valid.reduce((sum, s) => sum + s.km, 0)
  return { lifetime: (litres * 100) / km, last: valid[valid.length - 1].lPer100 }
}
