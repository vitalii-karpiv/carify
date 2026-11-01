import { Fuel } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { GAS_STATION_LABELS } from '@/lib/domain/enums'
import { formatNumber } from '@/lib/domain/money'
import { MIN_STATION_SEGMENTS, type StationStat } from '@/lib/domain/station-stats'
import { cn } from '@/lib/utils'
import { IconChip } from './icon-chip'

function Delta({ pct }: { pct: number }) {
  const rounded = Math.round(pct)
  if (rounded === 0) return <span className="text-xs text-muted-foreground">±0% vs avg</span>
  const cheaper = rounded < 0
  return (
    <span className={cn('text-xs font-medium', cheaper ? 'text-good' : 'text-bad')}>
      {cheaper ? '−' : '+'}
      {Math.abs(rounded)}% {cheaper ? '▼' : '▲'}
      <span className="sr-only">{cheaper ? ' cheaper than average' : ' more expensive than average'}</span>
    </span>
  )
}

export function StationCard({ stations }: { stations: StationStat[] }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconChip icon={Fuel} tint="fuel" className="size-7" />
          By station
          <span className="text-xs font-normal text-muted-foreground">₴ per 100 km</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        {stations.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Pick a station when you add fill-ups to compare them.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {stations.map((s) => (
              <li key={s.station} className="flex items-center justify-between gap-3 py-2.5">
                <div className={cn('min-w-0', !s.enoughData && 'opacity-60')}>
                  <div className="flex items-center gap-2 font-medium">
                    {GAS_STATION_LABELS[s.station]}
                    {s.best && (
                      <span className="rounded-full bg-tint-money/15 px-2 py-0.5 text-[11px] font-semibold text-tint-money">
                        Best
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatNumber(s.avgPricePerLitreKop / 100, 2)} ₴/L · {s.segments}{' '}
                    {s.segments === 1 ? 'segment' : 'segments'}
                  </div>
                </div>
                {s.enoughData && s.costPer100Kop !== null && s.lPer100 !== null ? (
                  <div className="flex shrink-0 flex-col items-end">
                    <span className="text-base font-semibold">{formatNumber(s.costPer100Kop / 100, 0)} ₴</span>
                    <span className="text-xs text-muted-foreground">{formatNumber(s.lPer100, 1)} L/100km</span>
                    {s.deltaPct !== null && <Delta pct={s.deltaPct} />}
                  </div>
                ) : (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    Not enough data ({s.segments}/{MIN_STATION_SEGMENTS})
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">Season and fuel grade affect these numbers.</p>
      </CardContent>
    </Card>
  )
}
