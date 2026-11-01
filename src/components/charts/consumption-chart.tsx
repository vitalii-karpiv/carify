'use client'

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'

export type ConsumptionPoint = { date: string; lPer100: number }

const config = { lPer100: { label: 'L/100km', color: 'var(--chart-1)' } } satisfies ChartConfig

export function ConsumptionChart({ data }: { data: ConsumptionPoint[] }) {
  return (
    <ChartContainer config={config} className="h-52 w-full" data-testid="consumption-chart">
      <AreaChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
        <defs>
          <linearGradient id="consumption-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-lPer100)" stopOpacity={0.25} />
            <stop offset="100%" stopColor="var(--color-lPer100)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
        <YAxis tickLine={false} axisLine={false} width={32} domain={['auto', 'auto']} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Area
          dataKey="lPer100"
          type="monotone"
          stroke="var(--color-lPer100)"
          strokeWidth={2}
          fill="url(#consumption-fill)"
          dot={{ r: 3, fill: 'var(--color-lPer100)', stroke: 'var(--card)', strokeWidth: 2 }}
        />
      </AreaChart>
    </ChartContainer>
  )
}
