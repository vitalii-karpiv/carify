import { CarFront, ChartLine, Droplet, Droplets, Gauge, Receipt, Tag, Wallet } from 'lucide-react'
import { ConsumptionChart } from '@/components/charts/consumption-chart'
import { MonthlyLitresChart, type LitresRow } from '@/components/charts/monthly-litres-chart'
import { MonthlySpendChart } from '@/components/charts/monthly-spend-chart'
import { PriceChart, type PriceRow } from '@/components/charts/price-chart'
import { IconChip, type Tint } from '@/components/dashboard/icon-chip'
import { StationCard } from '@/components/dashboard/station-card'
import { EmptyVehicles } from '@/components/shell/empty-vehicles'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { requireUser } from '@/lib/auth/session'
import { getVehicleDashboard } from '@/lib/data/overview'
import { formatDate } from '@/lib/domain/dates'
import { FUEL_GRADES, FUEL_GRADE_LABELS, GAS_STATION_LABELS } from '@/lib/domain/enums'
import { formatNumber, formatUah } from '@/lib/domain/money'
import { getSelectedVehicle } from '@/lib/vehicle-selection'

function StatTile({
  icon,
  tint,
  title,
  value,
  unit,
}: {
  icon: typeof Wallet
  tint: Tint
  title: string
  value: string
  unit: string
}) {
  return (
    <Card size="sm" className="gap-0 px-3">
      <IconChip icon={icon} tint={tint} />
      <div className="mt-2.5 text-xs leading-tight text-muted-foreground">{title}</div>
      <div className="mt-0.5 text-lg font-bold tracking-tight whitespace-nowrap">
        {value}
        <span className="ml-0.5 text-[11px] font-medium text-muted-foreground">{unit}</span>
      </div>
    </Card>
  )
}

function Section({
  icon,
  tint,
  title,
  unit,
  children,
}: {
  icon: typeof Wallet
  tint: Tint
  title: string
  unit?: string
  children: React.ReactNode
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconChip icon={icon} tint={tint} className="size-7" />
          {title}
          {unit && <span className="text-xs font-normal text-muted-foreground">{unit}</span>}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function NoData({ text }: { text: string }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{text}</p>
}

const monthLabel = (key: string) => `${key.slice(5)}.${key.slice(0, 4)}`
const oneDecimal = (v: number | null) => (v === null ? '—' : formatNumber(v, 1))

export default async function DashboardPage() {
  const user = await requireUser()
  const vehicle = await getSelectedVehicle(user.id)
  if (!vehicle) return <EmptyVehicles />
  const d = await getVehicleDashboard(user.id, vehicle.id, new Date())

  const consumptionData = d.segments
    .filter((x) => x.valid && x.lPer100 !== null)
    .map((x) => ({
      date: formatDate(x.endDate),
      lPer100: Math.round((x.lPer100 as number) * 10) / 10,
    }))

  const grades = FUEL_GRADES.filter((g) => d.pricePerLitre[g]?.length)
  const priceByDate = new Map<number, PriceRow>()
  for (const g of grades) {
    for (const p of d.pricePerLitre[g] ?? []) {
      const row = priceByDate.get(p.date.getTime()) ?? { date: formatDate(p.date) }
      row[g] = p.pricePerLitreKop / 100
      priceByDate.set(p.date.getTime(), row)
    }
  }
  const priceData = [...priceByDate.entries()].sort(([a], [b]) => a - b).map(([, row]) => row)

  const litreGrades = FUEL_GRADES.filter((g) => d.monthlyLitres.some((m) => m.litres[g] !== undefined))
  const litresData = d.monthlyLitres.map((m): LitresRow => ({ month: monthLabel(m.month), ...m.litres }))

  const monthlyData = d.monthly.map((m) => ({
    month: monthLabel(m.month),
    fuel: m.fuelKop / 100,
    service: m.serviceKop / 100,
  }))

  const lastFill =
    d.lastFill &&
    [
      `Last fill-up ${formatDate(d.lastFill.date)}`,
      d.lastFill.station && GAS_STATION_LABELS[d.lastFill.station],
      FUEL_GRADE_LABELS[d.lastFill.grade],
    ]
      .filter(Boolean)
      .join(' · ')

  return (
    <div className="flex flex-col gap-3.5">
      <section className="relative overflow-hidden rounded-3xl bg-brand-gradient p-5 text-white shadow-brand">
        <CarFront
          aria-hidden
          className="absolute -right-5 -bottom-7 size-40 opacity-15"
          strokeWidth={1.5}
        />
        <div className="relative flex flex-wrap items-center gap-2 text-sm text-white/85">
          {vehicle.make} {vehicle.model} · {vehicle.year}
          <span className="rounded-md bg-white/20 px-2 py-0.5 text-[11px] font-bold tracking-wide text-white">
            {vehicle.plate}
          </span>
        </div>
        <div className="relative mt-3 text-4xl font-bold tracking-tight">
          {d.currentOdometer === null ? '—' : formatNumber(d.currentOdometer, 0)}
          <span className="ml-1 text-base font-medium text-white/85">km</span>
        </div>
        <div className="relative mt-0.5 text-xs text-white/80">{lastFill ?? 'No fill-ups yet'}</div>
      </section>

      <div className="grid grid-cols-3 gap-2.5">
        <StatTile
          icon={Wallet}
          tint="money"
          title="This month"
          value={formatNumber(d.spendThisMonthKop / 100, 0)}
          unit="₴"
        />
        <StatTile
          icon={Gauge}
          tint="consumption"
          title="Avg consumption"
          value={oneDecimal(d.consumption.lifetime)}
          unit="L/100"
        />
        <StatTile
          icon={Droplet}
          tint="fuel"
          title="Last consumption"
          value={oneDecimal(d.consumption.last)}
          unit="L/100"
        />
      </div>

      <Section icon={ChartLine} tint="consumption" title="Consumption" unit="L/100km">
        {consumptionData.length === 0 ? (
          <NoData text="Not enough full fill-ups yet." />
        ) : (
          <ConsumptionChart data={consumptionData} />
        )}
      </Section>

      <Section icon={Droplets} tint="consumption" title="Litres per month" unit="L">
        {litresData.length === 0 ? (
          <NoData text="No fill-ups yet." />
        ) : (
          <MonthlyLitresChart
            data={litresData}
            series={litreGrades.map((g) => ({ key: g, label: FUEL_GRADE_LABELS[g] }))}
          />
        )}
      </Section>

      <Section icon={Tag} tint="fuel" title="Price per litre" unit="₴">
        {priceData.length === 0 ? (
          <NoData text="No fill-ups yet." />
        ) : (
          <PriceChart
            data={priceData}
            series={grades.map((g) => ({ key: g, label: FUEL_GRADE_LABELS[g] }))}
          />
        )}
      </Section>

      <StationCard stations={d.stations} />

      <Section icon={Wallet} tint="money" title="Monthly spend" unit="₴">
        {monthlyData.length === 0 ? (
          <NoData text="No spending yet." />
        ) : (
          <MonthlySpendChart data={monthlyData} />
        )}
      </Section>

      <Section icon={Receipt} tint="service" title="Totals">
        <dl className="grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Fuel</dt>
          <dd className="text-right font-medium">{formatUah(d.totals.fuelKop)}</dd>
          <dt className="text-muted-foreground">Service</dt>
          <dd className="text-right font-medium">{formatUah(d.totals.serviceKop)}</dd>
          <dt className="text-muted-foreground">Total</dt>
          <dd className="text-right font-semibold">{formatUah(d.totals.totalKop)}</dd>
          {d.costPerKmKop !== null && (
            <>
              <dt className="text-muted-foreground">Cost per km</dt>
              <dd className="text-right font-medium">{formatNumber(d.costPerKmKop / 100, 2)} ₴/km</dd>
            </>
          )}
        </dl>
      </Section>
    </div>
  )
}
