import { ConsumptionChart } from '@/components/charts/consumption-chart'
import { MonthlySpendChart } from '@/components/charts/monthly-spend-chart'
import { PriceChart, type PriceRow } from '@/components/charts/price-chart'
import { EmptyVehicles } from '@/components/shell/empty-vehicles'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { requireUser } from '@/lib/auth/session'
import { getVehicleStats } from '@/lib/data/overview'
import { formatDate } from '@/lib/domain/dates'
import { FUEL_GRADES, FUEL_GRADE_LABELS } from '@/lib/domain/enums'
import { formatConsumption, formatNumber, formatUah } from '@/lib/domain/money'
import { getSelectedVehicle } from '@/lib/vehicle-selection'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function NoData({ text }: { text: string }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{text}</p>
}

const monthLabel = (key: string) => `${key.slice(5)}.${key.slice(0, 4)}`

export default async function StatsPage() {
  const user = await requireUser()
  const vehicle = await getSelectedVehicle(user.id)
  if (!vehicle) return <EmptyVehicles />
  const s = await getVehicleStats(user.id, vehicle.id)

  const consumptionData = s.segments
    .filter((x) => x.valid && x.lPer100 !== null)
    .map((x) => ({
      date: formatDate(x.endDate),
      lPer100: Math.round((x.lPer100 as number) * 10) / 10,
    }))

  const grades = FUEL_GRADES.filter((g) => s.pricePerLitre[g]?.length)
  const priceByDate = new Map<number, PriceRow>()
  for (const g of grades) {
    for (const p of s.pricePerLitre[g] ?? []) {
      const row = priceByDate.get(p.date.getTime()) ?? { date: formatDate(p.date) }
      row[g] = p.pricePerLitreKop / 100
      priceByDate.set(p.date.getTime(), row)
    }
  }
  const priceData = [...priceByDate.entries()].sort(([a], [b]) => a - b).map(([, row]) => row)

  const monthlyData = s.monthly.map((m) => ({
    month: monthLabel(m.month),
    fuel: m.fuelKop / 100,
    service: m.serviceKop / 100,
  }))

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Stats</h1>
      <Section title="Consumption (L/100km)">
        <dl className="mb-3 grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Lifetime</dt>
          <dd className="text-right font-medium">
            {s.consumption.lifetime === null ? '—' : formatConsumption(s.consumption.lifetime)}
          </dd>
          <dt className="text-muted-foreground">Last</dt>
          <dd className="text-right font-medium">
            {s.consumption.last === null ? '—' : formatConsumption(s.consumption.last)}
          </dd>
        </dl>
        {consumptionData.length === 0 ? (
          <NoData text="Not enough full fill-ups yet." />
        ) : (
          <ConsumptionChart data={consumptionData} />
        )}
      </Section>
      <Section title="Price per litre (₴)">
        {priceData.length === 0 ? (
          <NoData text="No fill-ups yet." />
        ) : (
          <PriceChart
            data={priceData}
            series={grades.map((g) => ({ key: g, label: FUEL_GRADE_LABELS[g] }))}
          />
        )}
      </Section>
      <Section title="Monthly spend (₴)">
        {monthlyData.length === 0 ? (
          <NoData text="No spending yet." />
        ) : (
          <MonthlySpendChart data={monthlyData} />
        )}
      </Section>
      <Section title="Totals">
        <dl className="grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Fuel</dt>
          <dd className="text-right font-medium">{formatUah(s.totals.fuelKop)}</dd>
          <dt className="text-muted-foreground">Service</dt>
          <dd className="text-right font-medium">{formatUah(s.totals.serviceKop)}</dd>
          <dt className="text-muted-foreground">Total</dt>
          <dd className="text-right font-medium">{formatUah(s.totals.totalKop)}</dd>
          {s.costPerKmKop !== null && (
            <>
              <dt className="text-muted-foreground">Cost per km</dt>
              <dd className="text-right font-medium">{formatNumber(s.costPerKmKop / 100, 2)} ₴/km</dd>
            </>
          )}
        </dl>
      </Section>
    </div>
  )
}
