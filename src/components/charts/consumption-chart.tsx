'use client'

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'

export type ConsumptionPoint = { date: string; lPer100: number }

const config = { lPer100: { label: 'L/100km', color: 'var(--chart-2)' } } satisfies ChartConfig

export function ConsumptionChart({ data }: { data: ConsumptionPoint[] }) {
  return (
    <ChartContainer config={config} className="h-52 w-full" data-testid="consumption-chart">
      <LineChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
        <YAxis tickLine={false} axisLine={false} width={32} domain={['auto', 'auto']} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Line dataKey="lPer100" type="monotone" stroke="var(--color-lPer100)" strokeWidth={2} dot />
      </LineChart>
    </ChartContainer>
  )
}
