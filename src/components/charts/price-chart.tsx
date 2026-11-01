'use client'

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { formatUah } from '@/lib/domain/money'

export type PriceRow = { date: string; [grade: string]: number | string }
export type PriceSeries = { key: string; label: string }

// Color follows the grade, never its rank among the grades present.
const GRADE_SLOT: Record<string, number> = {
  A92: 1,
  A95: 2,
  A95_PLUS: 3,
  A98: 4,
  DIESEL: 5,
  DIESEL_PLUS: 6,
}

export function PriceChart({ data, series }: { data: PriceRow[]; series: PriceSeries[] }) {
  const config: ChartConfig = Object.fromEntries(
    series.map((s) => [s.key, { label: s.label, color: `var(--chart-${GRADE_SLOT[s.key] ?? 1})` }]),
  )
  return (
    <ChartContainer config={config} className="h-52 w-full" data-testid="price-chart">
      <LineChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
        <YAxis tickLine={false} axisLine={false} width={36} domain={['auto', 'auto']} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name) => (
                <span className="flex w-full justify-between gap-4">
                  <span className="text-muted-foreground">{config[String(name)]?.label ?? name}</span>
                  <span className="font-mono font-medium">{formatUah(Number(value) * 100)}</span>
                </span>
              )}
            />
          }
        />
        {series.length > 1 && <ChartLegend content={<ChartLegendContent />} />}
        {series.map((s) => (
          <Line
            key={s.key}
            dataKey={s.key}
            type="monotone"
            stroke={`var(--color-${s.key})`}
            strokeWidth={2}
            dot
            connectNulls
          />
        ))}
      </LineChart>
    </ChartContainer>
  )
}
