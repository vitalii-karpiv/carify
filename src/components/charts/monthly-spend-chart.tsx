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
import { formatUah } from '@/lib/domain/money'

export type MonthlyRow = { month: string; fuel: number; service: number }

const config = {
  fuel: { label: 'Fuel', color: 'var(--chart-1)' },
  service: { label: 'Service', color: 'var(--chart-2)' },
} satisfies ChartConfig

export function MonthlySpendChart({ data }: { data: MonthlyRow[] }) {
  return (
    <ChartContainer config={config} className="h-52 w-full" data-testid="monthly-chart">
      <BarChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
        <YAxis tickLine={false} axisLine={false} width={44} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name) => (
                <span className="flex w-full justify-between gap-4">
                  <span className="text-muted-foreground">
                    {config[name as keyof typeof config]?.label ?? name}
                  </span>
                  <span className="font-mono font-medium">{formatUah(Number(value) * 100)}</span>
                </span>
              )}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="fuel" stackId="spend" fill="var(--color-fuel)" stroke="var(--card)" strokeWidth={2} />
        <Bar dataKey="service" stackId="spend" fill="var(--color-service)" stroke="var(--card)" strokeWidth={2} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ChartContainer>
  )
}
