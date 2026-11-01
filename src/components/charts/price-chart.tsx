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
import { gradeColor } from './grade-colors'

export type PriceRow = { date: string; [grade: string]: number | string }
export type PriceSeries = { key: string; label: string }

export function PriceChart({ data, series }: { data: PriceRow[]; series: PriceSeries[] }) {
  const config: ChartConfig = Object.fromEntries(
    series.map((s) => [s.key, { label: s.label, color: gradeColor(s.key) }]),
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
