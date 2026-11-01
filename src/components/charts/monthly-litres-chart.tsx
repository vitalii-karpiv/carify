'use client'

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { formatNumber } from '@/lib/domain/money'
import { gradeColor } from './grade-colors'

export type LitresRow = { month: string; [grade: string]: number | string }
export type LitresSeries = { key: string; label: string }

export function MonthlyLitresChart({ data, series }: { data: LitresRow[]; series: LitresSeries[] }) {
  const config: ChartConfig = Object.fromEntries(
    series.map((s) => [s.key, { label: s.label, color: gradeColor(s.key) }]),
  )
  return (
    <ChartContainer config={config} className="h-52 w-full" data-testid="litres-chart">
      <BarChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
        <YAxis tickLine={false} axisLine={false} width={36} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name) => (
                <span className="flex w-full justify-between gap-4">
                  <span className="text-muted-foreground">{config[String(name)]?.label ?? name}</span>
                  <span className="font-mono font-medium">{formatNumber(Number(value), 1)} L</span>
                </span>
              )}
            />
          }
        />
        {series.length > 1 && <ChartLegend content={<ChartLegendContent />} />}
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            stackId="litres"
            fill={`var(--color-${s.key})`}
            stroke="var(--card)"
            strokeWidth={2}
            radius={i === series.length - 1 ? [3, 3, 0, 0] : undefined}
          />
        ))}
      </BarChart>
    </ChartContainer>
  )
}
