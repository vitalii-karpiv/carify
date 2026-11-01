import Link from 'next/link'
import { EmptyVehicles } from '@/components/shell/empty-vehicles'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { requireUser } from '@/lib/auth/session'
import { getVehicleOverview } from '@/lib/data/overview'
import { formatDate } from '@/lib/domain/dates'
import { formatKm, formatNumber, formatUah } from '@/lib/domain/money'
import { getSelectedVehicle } from '@/lib/vehicle-selection'

function Stat({ title, value }: { title: string; value: string }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-sm font-normal text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-xl font-semibold">{value}</CardContent>
    </Card>
  )
}

const consumption = (v: number | null) => (v === null ? '—' : `${formatNumber(v, 1)} L/100km`)

export default async function DashboardPage() {
  const user = await requireUser()
  const vehicle = await getSelectedVehicle(user.id)
  if (!vehicle) return <EmptyVehicles />
  const o = await getVehicleOverview(user.id, vehicle.id, new Date())

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{vehicle.name}</h1>
      <div className="grid grid-cols-2 gap-3">
        <Stat title="Odometer" value={o.currentOdometer === null ? '—' : formatKm(o.currentOdometer)} />
        <Stat title="This month" value={formatUah(o.spendThisMonthKop)} />
        <Stat title="Avg consumption" value={consumption(o.consumption.lifetime)} />
        <Stat title="Last consumption" value={consumption(o.consumption.last)} />
      </div>
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Recent</h2>
        <Link href="/stats" className="text-sm text-muted-foreground">
          Stats →
        </Link>
      </div>
      {o.recent.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No entries yet. Add a fill-up or service to see your stats.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {o.recent.map((e) => (
            <Link key={`${e.kind}-${e.id}`} href={`/${e.kind}/${e.id}`}>
              <Card className="flex-row items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="font-medium">{e.label}</div>
                  <div className="text-sm text-muted-foreground">
                    {formatDate(e.date)} · {formatKm(e.odometer)}
                  </div>
                </div>
                <div className="shrink-0 font-medium">{formatUah(e.totalKop)}</div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
