import { useState } from 'react'
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronDown,
  CircleHelp,
} from 'lucide-react'
import {
  healthMetrics,
  personalBaseline,
  reading,
  readingStatus,
  statusLabels,
  formatHealth,
  signedValue,
  healthSeries,
  MIN_BASELINE_DAYS,
  type HealthMetricKey,
  type PersonalBaseline,
  type HealthMetric,
} from '@/lib/health'
import { type DailyStats } from '@/lib/whoop'
import { palette } from '@/lib/palette'
import { cn } from '@/lib/utils'
import { HealthChart } from './health-chart'

const colors: Record<HealthMetricKey, string> = {
  hrv: palette.hrv,
  rhr: palette.rhr,
  respiratoryRate: palette.sleep,
  spo2: palette.recovery,
  skinTemp: palette.strain,
}
const dateLabel = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString('en', {
    month: 'short',
    day: 'numeric',
  })

export function HealthMonitor({
  days,
  current,
  range,
}: {
  days: DailyStats[]
  current: DailyStats | undefined
  range: number
}) {
  const [selected, setSelected] = useState<HealthMetricKey>('hrv')
  const metric = healthMetrics.find((m) => m.key === selected)!
  if (!current)
    return (
      <section className="panel">
        <p className="empty">
          Your Health Monitor will appear after your first sync.
        </p>
      </section>
    )
  const baselines = Object.fromEntries(
    healthMetrics.map((m) => [
      m.key,
      personalBaseline(days, current.date, m.key),
    ]),
  ) as Record<HealthMetricKey, PersonalBaseline>
  const baseline = baselines[selected]
  const value = reading(current, selected)
  const status = readingStatus(current, selected, baseline)
  const series = healthSeries(days, current.date, selected, range)
  const available = healthMetrics.filter(
    (m) => reading(current, m.key) !== null,
  ).length
  const outside = healthMetrics.filter((m) =>
    ['above', 'below'].includes(
      readingStatus(current, m.key, baselines[m.key]),
    ),
  ).length
  const change =
    value !== null && baseline.median !== null && status !== 'calibrating'
      ? value - baseline.median
      : null

  return (
    <div className="health-monitor">
      <div className="health-intro">
        <div>
          <p className="eyebrow">Your nightly signals</p>
          <p>
            {available} of 5 readings available
            {outside > 0 ? ` · ${outside} outside the recent range` : ''}
          </p>
        </div>
        <a
          href="#health-method"
          className="text-btn"
          onClick={() =>
            document.getElementById('health-method')?.setAttribute('open', '')
          }
        >
          <CircleHelp size={14} aria-hidden /> How comparisons work
        </a>
      </div>
      <div
        className="health-cards"
        role="group"
        aria-label="Choose a health metric"
      >
        {healthMetrics.map((m) => {
          const v = reading(current, m.key)
          const state = readingStatus(current, m.key, baselines[m.key])
          const delta =
            v !== null &&
            baselines[m.key].median !== null &&
            state !== 'calibrating'
              ? v - baselines[m.key].median!
              : null
          return (
            <button
              key={m.key}
              className="health-card"
              aria-pressed={selected === m.key}
              onClick={() => setSelected(m.key)}
              aria-controls="health-detail"
            >
              <span className="health-card-label">
                <i style={{ background: colors[m.key] }} />
                {m.short}
              </span>
              <span className="health-card-value">
                {formatHealth(v, m, false)}
                <small>{m.unit}</small>
              </span>
              {m.key === 'skinTemp' && delta !== null && (
                <span className="health-temperature-delta">
                  {signedValue(delta)} °C from median
                </span>
              )}
              <span
                className="health-status"
                data-outside={
                  state === 'above' || state === 'below' || undefined
                }
              >
                {state === 'above' ? (
                  <ArrowUpRight size={13} aria-hidden />
                ) : state === 'below' ? (
                  <ArrowDownRight size={13} aria-hidden />
                ) : (
                  <i />
                )}
                {statusLabels[state]}
              </span>
            </button>
          )
        })}
      </div>

      <section
        className="panel health-detail"
        id="health-detail"
        aria-label={`${metric.label} details`}
      >
        <div className="panel-heading">
          <div>
            <h3>{metric.label}</h3>
            <p>{metric.description}</p>
          </div>
          <span className="source-label">{metric.source}</span>
        </div>
        <div className="health-detail-grid">
          <div className="health-history">
            <div className="chart-stat">
              <strong>{formatHealth(value, metric)}</strong>
              <span>{dateLabel(current.date)}</span>
            </div>
            <ul className="legend health-legend" aria-label="Chart legend">
              <li>
                <i style={{ background: colors[selected] }} />
                WHOOP reading
              </li>
              <li>
                <i className="range-swatch" />
                FORM range
              </li>
              <li>
                <i className="median-swatch" />
                FORM median
              </li>
            </ul>
            <HealthChart
              key={selected}
              data={series}
              metric={metric}
              color={colors[selected]}
            />
          </div>
          <aside className="health-context" aria-label="Personal comparison">
            <p className="eyebrow">Personal comparison</p>
            <p className="health-context-status">{statusLabels[status]}</p>
            {status === 'missing' ? (
              <p className="detail-copy">
                {selected === 'respiratoryRate'
                  ? 'WHOOP has not supplied a scored main-sleep reading for this day.'
                  : current.recoveryState !== 'SCORED'
                    ? 'This day’s recovery is not scored. Check again after WHOOP processes your sleep.'
                    : 'WHOOP did not return this metric. Device support and data availability can affect readings.'}{' '}
                Missing does not mean zero.
              </p>
            ) : status === 'calibrating' ? (
              <p className="detail-copy">
                WHOOP is still calibrating. The reading is shown, but it is not
                used for a FORM comparison or reference range.
              </p>
            ) : !baseline.ready ? (
              <p className="detail-copy">
                {baseline.count} of {MIN_BASELINE_DAYS} valid prior days
                available. Comparisons appear once there is enough history in
                the preceding 30 days.
              </p>
            ) : (
              <>
                <p className="health-change">
                  {signedValue(change!, metric.decimals)}
                  <small>
                    {' '}
                    {metric.unit === '%' ? 'percentage points' : metric.unit}
                  </small>
                </p>
                <p className="detail-copy">
                  from your preceding 30-day median. A difference is not a
                  diagnosis or a better/worse score.
                </p>
              </>
            )}
            {baseline.ready && (
              <>
                <RangePosition
                  value={status === 'calibrating' ? null : value}
                  baseline={baseline}
                  metric={metric}
                />
                <dl className="detail-list">
                  <div>
                    <dt>FORM median</dt>
                    <dd>{formatHealth(baseline.median, metric)}</dd>
                  </div>
                  <div>
                    <dt>Recent range</dt>
                    <dd>
                      {formatHealth(baseline.low, metric, false)}–
                      {formatHealth(baseline.high, metric)}
                    </dd>
                  </div>
                  <div>
                    <dt>Prior days used</dt>
                    <dd>{baseline.count} / 30</dd>
                  </div>
                </dl>
              </>
            )}
            <span className="comparison-period">
              Reference: {dateLabel(baseline.start)}–{dateLabel(baseline.end)}
            </span>
          </aside>
        </div>
        <div className="panel-foot">
          <span>
            {series.filter((p) => p.value !== null).length} readings in {range}{' '}
            days · gaps stay empty
          </span>
          <span>Auto-scaled chart · not live data</span>
        </div>
      </section>

      <details className="daily-table health-readings">
        <summary>
          Readings & comparisons <ChevronDown size={15} aria-hidden />
        </summary>
        <div
          className="table-scroll"
          tabIndex={0}
          role="region"
          aria-label={`${metric.label} readings table`}
        >
          <table>
            <caption className="sr-only">
              {metric.label}: exact readings and rolling FORM comparisons.
              Missing values are shown as a dash.
            </caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">WHOOP reading</th>
                <th scope="col">FORM median</th>
                <th scope="col">FORM range</th>
                <th scope="col">Comparison</th>
              </tr>
            </thead>
            <tbody>
              {[...series].reverse().map((point) => {
                const day = days.find((d) => d.date === point.day)
                const b = personalBaseline(days, point.day, selected)
                return (
                  <tr key={point.day}>
                    <th scope="row">{dateLabel(point.day)}</th>
                    <td>{formatHealth(point.value, metric)}</td>
                    <td>{formatHealth(b.median, metric)}</td>
                    <td>
                      {b.ready
                        ? `${formatHealth(b.low, metric, false)}–${formatHealth(b.high, metric)}`
                        : '—'}
                    </td>
                    <td>{statusLabels[readingStatus(day, selected, b)]}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </details>
      <details className="health-method" id="health-method">
        <summary>
          <CircleHelp size={15} aria-hidden /> About these comparisons{' '}
          <ChevronDown size={15} aria-hidden />
        </summary>
        <div>
          <p>
            <strong>WHOOP readings. FORM comparisons.</strong> The median and
            shaded range are calculated here, not supplied by WHOOP Health
            Monitor.
          </p>
          <p>
            For each day, we use up to 30 preceding calendar days, excluding
            that day, future days, missing readings and WHOOP-calibrating
            recovery readings. At least 14 distinct days are required.
            Respiratory rate comes from sleep and is evaluated independently.
          </p>
          <p>
            The range is the 10th–90th percentile: the middle 80% of prior
            readings. Values outside it can occur during ordinary variation.
            These are descriptive comparisons, not clinical thresholds, WHOOP
            alerts, or a health assessment.
          </p>
          <p>
            Changing the chart period does not change the 30-day calculation.
            Older imported days may have insufficient preceding history. The API
            provides summary readings, not continuous heart-rate or overnight
            sensor traces.
          </p>
        </div>
      </details>
    </div>
  )
}

function RangePosition({
  value,
  baseline,
  metric,
}: {
  value: number | null
  baseline: PersonalBaseline
  metric: HealthMetric
}) {
  const low = baseline.low!,
    high = baseline.high!
  const padding = Math.max((high - low) * 0.4, 10 ** -metric.decimals)
  const min = Math.min(low - padding, value ?? low)
  const max = Math.max(high + padding, value ?? high)
  const position = (n: number) => 5 + ((n - min) / (max - min)) * 90
  return (
    <div
      className="range-position"
      role="img"
      aria-label={`Recent range ${formatHealth(low, metric)} to ${formatHealth(high, metric)}. ${value === null ? 'No comparison reading.' : `Selected reading ${formatHealth(value, metric)}.`}`}
    >
      <span className="range-track" />
      <span
        className="range-band"
        style={{
          left: `${position(low)}%`,
          width: `${Math.max(1, position(high) - position(low))}%`,
        }}
      />
      <span
        className="range-median"
        style={{ left: `${position(baseline.median!)}%` }}
      />
      {value !== null && (
        <span
          className={cn('range-reading')}
          style={{ left: `${position(value)}%` }}
        />
      )}
    </div>
  )
}
