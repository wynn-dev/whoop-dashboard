import { area, line } from 'd3-shape'
import { scaleLinear } from '@visx/scale'
import { useMemo } from 'react'
import { LineChart } from './charts/line-chart'
import { XAxis } from './charts/x-axis'
import { ChartTooltip } from './charts/tooltip'
import { useChartStable } from './charts/chart-context'
import {
  formatHealth,
  type HealthMetric,
  type healthSeries,
} from '@/lib/health'
import { ChartEmpty } from './performance-charts'

type HealthPoint = ReturnType<typeof healthSeries>[number]

// Vitals need an explicitly labelled, data-relative axis: zero-based temperature
// and SpO₂ charts hide small changes and collapse the observed range to a line.
function useHealthScale(metric: HealthMetric) {
  const { data, innerHeight } = useChartStable()
  return useMemo(() => {
    const values = data
      .flatMap((p) => [p.value, p.low, p.high])
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
    const low = Math.min(...values),
      high = Math.max(...values)
    const padding = Math.max((high - low) * 0.15, 2 * 10 ** -metric.decimals)
    return scaleLinear({
      domain: [
        Math.max(0, low - padding),
        metric.key === 'spo2' ? Math.min(100, high + padding) : high + padding,
      ],
      range: [innerHeight, 0],
      nice: true,
    })
  }, [data, innerHeight, metric])
}

// Keep Bklit's responsive layout, scales and interaction. This SVG series uses
// explicit gaps: a missing night must never be plotted as zero or interpolated.
function HealthPlot({
  dataKey: _dataKey,
  color,
  metric,
}: {
  dataKey: string
  color: string
  metric: HealthMetric
}) {
  const { data, xScale, innerHeight } = useChartStable()
  const y = useHealthScale(metric)
  const points = data as HealthPoint[]
  const x = (p: HealthPoint) => xScale(p.date) ?? 0
  const band = area<HealthPoint>()
    .defined((p) => p.low !== null && p.high !== null)
    .x(x)
    .y0((p) => y(p.low!) ?? 0)
    .y1((p) => y(p.high!) ?? 0)(points)
  const median = line<HealthPoint>()
    .defined((p) => p.median !== null)
    .x(x)
    .y((p) => y(p.median!) ?? 0)(points)
  const path = line<HealthPoint>()
    .defined((p) => p.value !== null)
    .x(x)
    .y((p) => y(p.value!) ?? 0)(points)
  return (
    <g pointerEvents="none">
      {band && (
        <path
          d={band}
          fill="var(--ink-3)"
          fillOpacity={0.12}
          data-health-band
        />
      )}
      {median && (
        <path
          d={median}
          fill="none"
          stroke="var(--ink-3)"
          strokeWidth={1}
          strokeDasharray="4 4"
        />
      )}
      {path && (
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinejoin="round"
          data-health-line
        />
      )}
      {points.map((p) =>
        p.value !== null ? (
          <circle
            key={p.day}
            cx={x(p)}
            cy={y(p.value)}
            r={p === points.at(-1) ? 4 : 2.5}
            fill={p.calibrating ? 'var(--surface)' : color}
            stroke={color}
            strokeWidth={1.5}
          />
        ) : (
          <line
            key={p.day}
            x1={x(p) - 2}
            x2={x(p) + 2}
            y1={innerHeight - 2}
            y2={innerHeight - 2}
            stroke="var(--ink-3)"
          />
        ),
      )}
    </g>
  )
}

function DomainBound(_props: { dataKey: string }) {
  return null
}

function YAxis({ metric }: { metric: HealthMetric }) {
  const y = useHealthScale(metric)
  const { innerWidth } = useChartStable()
  return (
    <g aria-hidden="true" pointerEvents="none">
      {y.ticks(4).map((value) => (
        <g key={value} transform={`translate(0,${y(value)})`}>
          <line x2={innerWidth} stroke="var(--line-strong)" />
          <text
            x={-10}
            dy="0.32em"
            textAnchor="end"
            fill="var(--ink-2)"
            fontSize={11}
          >
            {value.toFixed(metric.decimals)}
          </text>
        </g>
      ))}
    </g>
  )
}
YAxis.displayName = 'YAxis'

export function HealthChart({
  data,
  metric,
  color,
}: {
  data: HealthPoint[]
  metric: HealthMetric
  color: string
}) {
  if (!data.some((p) => p.value !== null))
    return (
      <ChartEmpty
        height={260}
        text="No readings in this period. A chart appears when WHOOP returns this metric."
      />
    )
  return (
    <figure
      className="chart-figure health-chart"
      aria-label={`${metric.label}, ${data.length} days. Gaps mean no reading. Exact values and FORM comparisons are in the readings table below.`}
    >
      <LineChart
        data={data}
        animationDuration={0}
        yDomainTween={false}
        aspectRatio="auto"
        style={{
          height: 280,
          minHeight: 280,
          flex: 'none',
          touchAction: 'pan-y',
        }}
        margin={{ top: 18, bottom: 40, left: 46, right: 16 }}
      >
        <YAxis metric={metric} />
        <DomainBound dataKey="low" />
        <DomainBound dataKey="high" />
        <HealthPlot dataKey="value" color={color} metric={metric} />
        <XAxis numTicks={4} />
        <ChartTooltip
          showDots={false}
          rows={(p) => [
            {
              label: metric.short,
              color,
              value: formatHealth(
                typeof p.value === 'number' ? p.value : null,
                metric,
              ),
            },
            ...(typeof p.median === 'number'
              ? [
                  {
                    label: 'FORM median',
                    color: 'var(--ink-3)',
                    value: formatHealth(p.median, metric),
                  },
                ]
              : []),
            ...(p.calibrating
              ? [
                  {
                    label: 'Status',
                    value: 'WHOOP calibrating',
                    color: 'var(--ink-3)',
                  },
                ]
              : []),
          ]}
        />
      </LineChart>
    </figure>
  )
}
