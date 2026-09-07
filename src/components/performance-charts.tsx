import { AreaChart } from '@/components/charts/area-chart'
import { Area } from '@/components/charts/area'
import { BarChart } from '@/components/charts/bar-chart'
import { Bar } from '@/components/charts/bar'
import { BarXAxis } from '@/components/charts/bar-x-axis'
import { XAxis } from '@/components/charts/x-axis'
import { Grid } from '@/components/charts/grid'
import { ChartTooltip } from '@/components/charts/tooltip'
import { RingChart } from '@/components/charts/ring-chart'
import { Ring } from '@/components/charts/ring'
import { duration, type DailyStats } from '@/lib/whoop'
import type { LucideIcon } from 'lucide-react'
import { useReducedMotion } from 'motion/react'

export function MetricRing({
  value,
  max,
  color,
  icon: Icon,
}: {
  value: number | null
  max: number
  color: string
  icon: LucideIcon
}) {
  const reducedMotion = useReducedMotion()
  return (
    <div className="metric-ring" aria-hidden="true">
      <RingChart
        size={88}
        strokeWidth={5}
        baseInnerRadius={28}
        data={[
          {
            label: 'Progress',
            value: Math.min(value ?? 0, max),
            maxValue: max,
            color,
          },
        ]}
      >
        <Ring index={0} showGlow={false} animate={!reducedMotion} />
      </RingChart>
      <Icon className="ring-icon" size={23} style={{ color }} />
    </div>
  )
}

export function TrendChart({
  days,
  metric,
  color,
  label,
  unit,
}: {
  days: DailyStats[]
  metric: 'recovery' | 'strain' | 'hrv' | 'rhr' | 'sleepHours'
  color: string
  label: string
  unit: string
}) {
  const reducedMotion = useReducedMotion()
  const data = days
    .filter((day) => day[metric] !== null)
    .map((day) => ({
      date: new Date(`${day.date}T12:00:00`),
      value: day[metric],
    }))
  if (data.length < 2)
    return <ChartEmpty text="Your trend will appear after two scored days." />
  return (
    <figure
      aria-label={`${label} over ${days.length} recorded days. Exact values are available in the daily data table.`}
      className="chart-figure"
    >
      <AreaChart
        data={data}
        animationDuration={reducedMotion ? 0 : 800}
        aspectRatio="auto"
        style={{ height: 245 }}
        margin={{ top: 18, bottom: 38, left: 14, right: 14 }}
      >
        <Grid numTicksRows={4} strokeDasharray="3,5" stroke="var(--border)" />
        <Area
          dataKey="value"
          fill={color}
          stroke={color}
          fillOpacity={0.19}
          strokeWidth={2.5}
        />
        <XAxis numTicks={5} />
        <ChartTooltip
          rows={(point) => [
            {
              color,
              label,
              value:
                metric === 'sleepHours'
                  ? duration(Number(point.value))
                  : `${Number(point.value).toFixed(metric === 'strain' ? 1 : 0)}${unit}`,
            },
          ]}
        />
      </AreaChart>
    </figure>
  )
}

export function SleepChart({ days }: { days: DailyStats[] }) {
  const reducedMotion = useReducedMotion()
  const data = days
    .filter((day) => day.sleepHours !== null)
    .map((day) => ({
      name: new Date(`${day.date}T12:00:00`).toLocaleDateString('en', {
        month: 'short',
        day: 'numeric',
      }),
      Deep: day.deepHours,
      REM: day.remHours,
      Light: day.lightHours,
    }))
  if (!data.length)
    return (
      <ChartEmpty text="Your sleep stages will appear after your first sync." />
    )
  return (
    <figure
      aria-label="Sleep duration by day, divided into deep, REM, and light sleep. Exact values are in the daily data table."
      className="chart-figure sleep-bars"
    >
      <BarChart
        data={data}
        xDataKey="name"
        stacked
        stackGap={2}
        animationDuration={reducedMotion ? 0 : 800}
        aspectRatio="2.5 / 1"
        margin={{ top: 10, bottom: 35, left: 10, right: 10 }}
        barGap={data.length > 30 ? 0.2 : 0.4}
      >
        <Grid numTicksRows={3} strokeDasharray="3,5" stroke="var(--border)" />
        <Bar
          dataKey="Deep"
          fill="#766795"
          lineCap={2}
          animate={!reducedMotion}
        />
        <Bar
          dataKey="REM"
          fill="#b7a3de"
          lineCap={2}
          animate={!reducedMotion}
        />
        <Bar
          dataKey="Light"
          fill="#ddd3ed"
          lineCap={2}
          animate={!reducedMotion}
        />
        <BarXAxis maxLabels={5} />
        <ChartTooltip
          showDatePill={false}
          showDots={false}
          rows={(point) => [
            {
              label: 'Deep',
              color: '#766795',
              value: duration(Number(point.Deep)),
            },
            {
              label: 'REM',
              color: '#b7a3de',
              value: duration(Number(point.REM)),
            },
            {
              label: 'Light',
              color: '#ddd3ed',
              value: duration(Number(point.Light)),
            },
          ]}
        />
      </BarChart>
    </figure>
  )
}

export function ChartEmpty({ text }: { text: string }) {
  return (
    <div className="chart-empty">
      <div className="empty-grid" />
      <p>{text}</p>
    </div>
  )
}
