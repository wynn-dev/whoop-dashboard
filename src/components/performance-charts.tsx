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
import { palette } from '@/lib/palette'
import { useReducedMotion } from 'motion/react'

export type TrendMetric = 'recovery' | 'strain' | 'hrv' | 'rhr' | 'sleepHours'

export const trendMetrics: Record<
  TrendMetric,
  { label: string; color: string; format: (value: number) => string }
> = {
  recovery: {
    label: 'Recovery',
    color: palette.recovery,
    format: (v) => `${Math.round(v)}%`,
  },
  strain: {
    label: 'Strain',
    color: palette.strain,
    format: (v) => v.toFixed(1),
  },
  sleepHours: { label: 'Time asleep', color: palette.sleep, format: duration },
  hrv: {
    label: 'HRV',
    color: palette.hrv,
    format: (v) => `${Math.round(v)} ms`,
  },
  rhr: {
    label: 'Resting heart rate',
    color: palette.rhr,
    format: (v) => `${Math.round(v)} bpm`,
  },
}

const GRID = 'var(--line-strong)'

export function MetricRing({
  value,
  max,
  color,
}: {
  value: number | null
  max: number
  color: string
}) {
  const reducedMotion = useReducedMotion()
  return (
    <span className="metric-ring" aria-hidden="true">
      <RingChart
        size={64}
        strokeWidth={4}
        baseInnerRadius={26}
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
    </span>
  )
}

export function TrendChart({
  days,
  metric,
  height = 232,
}: {
  days: DailyStats[]
  metric: TrendMetric
  height?: number
}) {
  const reducedMotion = useReducedMotion()
  const { label, color, format } = trendMetrics[metric]
  const data = days
    .filter((day) => day[metric] !== null)
    .map((day) => ({
      date: new Date(`${day.date}T12:00:00`),
      value: day[metric],
    }))
  if (data.length < 2)
    return (
      <ChartEmpty
        height={height}
        text="A trend appears after two scored days."
      />
    )
  return (
    <figure
      aria-label={`${label} over ${days.length} recorded days. Exact values are in the daily data table.`}
      className="chart-figure"
    >
      <AreaChart
        data={data}
        animationDuration={reducedMotion ? 0 : 700}
        aspectRatio="auto"
        style={{ height: '100%', minHeight: height }}
        margin={{ top: 12, bottom: 36, left: 10, right: 10 }}
      >
        <Grid
          numTicksRows={4}
          stroke={GRID}
          strokeWidth={1}
          strokeDasharray="0"
          strokeOpacity={1}
        />
        <Area
          dataKey="value"
          fill={color}
          stroke={color}
          fillOpacity={0.1}
          strokeWidth={2}
        />
        <XAxis numTicks={days.length > 10 ? 5 : 4} />
        <ChartTooltip
          rows={(point) => [
            { color, label, value: format(Number(point.value)) },
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
      <ChartEmpty
        height={200}
        text="Sleep stages appear after your first sync."
      />
    )
  return (
    <figure
      aria-label="Sleep duration by night, divided into deep, REM, and light sleep. Exact values are in the daily data table."
      className="chart-figure sleep-bars"
    >
      <BarChart
        data={data}
        xDataKey="name"
        stacked
        stackGap={2}
        animationDuration={reducedMotion ? 0 : 700}
        aspectRatio="2.4 / 1"
        margin={{ top: 8, bottom: 34, left: 10, right: 10 }}
        barGap={0.35}
        barWidth={data.length <= 14 ? 20 : undefined}
      >
        <Grid
          numTicksRows={3}
          stroke={GRID}
          strokeWidth={1}
          strokeDasharray="0"
          strokeOpacity={1}
        />
        <Bar
          dataKey="Deep"
          fill={palette.deep}
          lineCap={2}
          animate={!reducedMotion}
        />
        <Bar
          dataKey="REM"
          fill={palette.rem}
          lineCap={2}
          animate={!reducedMotion}
        />
        <Bar
          dataKey="Light"
          fill={palette.light}
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
              color: palette.deep,
              value: duration(Number(point.Deep)),
            },
            {
              label: 'REM',
              color: palette.rem,
              value: duration(Number(point.REM)),
            },
            {
              label: 'Light',
              color: palette.light,
              value: duration(Number(point.Light)),
            },
          ]}
        />
      </BarChart>
    </figure>
  )
}

export function SleepStagesBar({ day }: { day: DailyStats }) {
  const segments = [
    { label: 'Deep', hours: day.deepHours, color: palette.deep },
    { label: 'REM', hours: day.remHours, color: palette.rem },
    { label: 'Light', hours: day.lightHours, color: palette.light },
    { label: 'Awake', hours: day.awakeHours, color: palette.awake },
  ].filter((s): s is typeof s & { hours: number } => s.hours != null)
  const total = segments.reduce((sum, s) => sum + s.hours, 0)
  if (!total) return null
  return (
    <div className="stages">
      <div
        className="stages-bar"
        role="img"
        aria-label={segments
          .map((s) => `${s.label} ${duration(s.hours)}`)
          .join(', ')}
      >
        {segments.map((s) => (
          <span
            key={s.label}
            style={{ flexGrow: s.hours, background: s.color }}
          />
        ))}
      </div>
      <ul className="stages-legend">
        {segments.map((s) => (
          <li key={s.label}>
            <i style={{ background: s.color }} />
            <span>{s.label}</span>
            <strong>{duration(s.hours)}</strong>
            <small>{Math.round((s.hours / total) * 100)}%</small>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function ChartEmpty({
  text,
  height = 232,
}: {
  text: string
  height?: number
}) {
  return (
    <div className="chart-empty" style={{ height }}>
      <p>{text}</p>
    </div>
  )
}
