import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import {
  balanceSeries,
  bounceBack,
  coverage,
  eveningSessions,
  hardDaySequences,
  highlights,
  hrvReadiness,
  HRV_BASELINE,
  HRV_ROLLING,
  MIN_EPISODES,
  MIN_GROUP,
  MIN_MONTH_DAYS,
  MIN_RELATIONSHIP_DAYS,
  MIN_SIGNAL_BASELINE,
  MIN_SPORT_SESSIONS,
  MIN_WEEKEND_NIGHTS,
  monotony,
  monotonyLabel,
  monthAgainstMonth,
  morningAfterBySport,
  napEffect,
  regularity,
  relationships,
  sleepArchitecture,
  socialJetlag,
  stability,
  unusualNights,
  weekendVersusWeekday,
  zoneTotals,
  HARD_STRAIN,
} from '@/lib/analysis'
import { clockFromNight, workoutHours } from '@/lib/insights'
import {
  duration,
  localDate,
  type DailyStats,
  type StoredRecord,
  type WhoopRecord,
} from '@/lib/whoop'
import { palette } from '@/lib/palette'
import { cn } from '@/lib/utils'
import { Delta, Heading } from './insights'
import { HealthChart } from './health-chart'

const dateLabel = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString('en', {
    month: 'short',
    day: 'numeric',
  })
const dash = '—'
const pct = (value: number | null, decimals = 0) =>
  value == null ? dash : `${value.toFixed(decimals)}%`
const num = (value: number | null, decimals = 0) =>
  value == null ? dash : value.toFixed(decimals)
const signedHours = (hours: number) =>
  `${hours < -1 / 120 ? '−' : hours > 1 / 120 ? '+' : ''}${duration(Math.abs(hours))}`

function Method({ children }: { children: ReactNode }) {
  return (
    <details className="method">
      <summary>
        How this is computed <ChevronDown size={14} aria-hidden />
      </summary>
      <div>{children}</div>
    </details>
  )
}

function Needs({ children }: { children: ReactNode }) {
  return <p className="empty needs">{children}</p>
}

function Group({
  title,
  intro,
  children,
}: {
  title: string
  intro: string
  children: ReactNode
}) {
  return (
    <div className="analysis-group">
      <div className="analysis-group-head">
        <h4>{title}</h4>
        <p>{intro}</p>
      </div>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// A. Relationships
// ---------------------------------------------------------------------------
function Relationships({
  allDays,
  days,
  range,
}: {
  allDays: DailyStats[]
  days: DailyStats[]
  range: number
}) {
  const results = relationships(allDays, days)
  const clear = results.filter((r) => r.clear)
  return (
    <section className="panel">
      <Heading
        title="How your days relate"
        description={
          results.length
            ? `${clear.length} clear ${clear.length === 1 ? 'link' : 'links'} out of ${results.length} tested over the last ${range} days`
            : `Last ${range} days`
        }
      />
      {results.length ? (
        <ol className="relationships">
          {results.map((r) => (
            <li
              key={r.key}
              className={cn('relationship', !r.clear && 'unclear')}
            >
              <div className="relationship-text">
                <strong>{r.reading}</strong>
                <span>
                  {r.factor} → {r.outcome} · {r.n} days ·{' '}
                  {r.clear ? r.strength : 'unclear'}
                </span>
              </div>
              <div
                className="ci"
                role="img"
                aria-label={`Correlation ${r.rho.toFixed(2)}, 95% interval ${r.interval[0].toFixed(2)} to ${r.interval[1].toFixed(2)}`}
              >
                <span className="ci-zero" />
                <span
                  className="ci-range"
                  style={{
                    left: `${((r.interval[0] + 1) / 2) * 100}%`,
                    width: `${((r.interval[1] - r.interval[0]) / 2) * 100}%`,
                  }}
                />
                <span
                  className="ci-dot"
                  style={{ left: `${((r.rho + 1) / 2) * 100}%` }}
                />
              </div>
              <span className="relationship-rho">
                {r.rho > 0 ? '+' : ''}
                {r.rho.toFixed(2)}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <Needs>
          Each link needs at least {MIN_RELATIONSHIP_DAYS} days with both
          readings. The 30- or 90-day view usually has enough.
        </Needs>
      )}
      <Method>
        <p>
          Each row is a Spearman rank correlation between one factor and the
          recovery or HRV recorded in the same physiological cycle (sleep
          precedes that morning’s score; strain is taken from the previous day).
          It runs from −1 to +1 and captures whether higher values of one tend
          to go with higher or lower values of the other, not how much.
        </p>
        <p>
          The bar shows a 95% interval from Fisher’s transform. A link is called
          clear only when that interval excludes zero; with {range} days the
          interval is wide, so many real effects will still read as unclear.
          Strength labels: under 0.2 negligible, 0.4 weak, 0.6 moderate, above
          that strong. Correlation is not causation, and every factor here is
          confounded with the others.
        </p>
      </Method>
    </section>
  )
}

// ---------------------------------------------------------------------------
// B. Unusual nights
// ---------------------------------------------------------------------------
function UnusualNights({
  allDays,
  days,
  range,
}: {
  allDays: DailyStats[]
  days: DailyStats[]
  range: number
}) {
  const result = unusualNights(allDays, days)
  return (
    <section className="panel">
      <Heading
        title="Unusual nights"
        description={`${result.evaluated} of the last ${range} nights checked against their own preceding 30 days`}
      />
      {result.nights.length ? (
        <ul className="nights">
          {result.nights.slice(0, 8).map((night) => (
            <li key={night.date}>
              <strong>{dateLabel(night.date)}</strong>
              <span className="night-signals">
                {night.signals.map((signal) => (
                  <span className="chip" key={signal.key}>
                    {signal.label}{' '}
                    <b>
                      {signal.value.toFixed(signal.unit === 'bpm' ? 0 : 1)}{' '}
                      {signal.unit}
                    </b>
                    <small>
                      {' '}
                      vs {signal.median.toFixed(
                        signal.unit === 'bpm' ? 0 : 1,
                      )}{' '}
                      usual
                    </small>
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ul>
      ) : result.evaluated ? (
        <p className="empty">
          No nights in this period had two or more signals outside their usual
          range at once.
        </p>
      ) : (
        <Needs>
          Each signal needs {MIN_SIGNAL_BASELINE} prior readings in the
          preceding 30 days before a night can be checked.
        </Needs>
      )}
      {result.building > 0 && result.evaluated > 0 && (
        <p className="detail-copy">
          {result.building} {result.building === 1 ? 'night' : 'nights'} could
          not be checked yet because their baseline was still building.
        </p>
      )}
      <Method>
        <p>
          For each night, resting heart rate, HRV, respiratory rate, and skin
          temperature are compared with your own readings from the preceding 30
          days using the median and the median absolute deviation, which are not
          thrown off by a single odd night. A signal counts when it sits more
          than two deviations in the direction that usually goes with stress or
          illness: heart rate, breathing, and temperature up, HRV down. A night
          is listed only when at least two signals move together. Nights WHOOP
          marked as calibrating are excluded.
        </p>
        <p>
          This is a description of your data, not a diagnosis. Alcohol, late
          meals, heat, travel, and hard training produce the same pattern.
        </p>
      </Method>
    </section>
  )
}

// ---------------------------------------------------------------------------
// C. HRV readiness
// ---------------------------------------------------------------------------
function HrvReadiness({
  allDays,
  end,
  range,
}: {
  allDays: DailyStats[]
  end: string
  range: number
}) {
  const result = hrvReadiness(allDays, end, range)
  const status =
    result.status === 'within'
      ? 'Within your usual band'
      : result.status === 'above'
        ? 'Above your usual band'
        : result.status === 'below'
          ? 'Below your usual band'
          : 'Building your baseline'
  return (
    <section className="panel">
      <Heading
        title="HRV readiness"
        description={`${HRV_ROLLING}-day average against a ${HRV_BASELINE}-day band, through ${dateLabel(end)}`}
      />
      <div className="chart-stat">
        <strong>
          {result.latest.value == null
            ? dash
            : `${Math.round(result.latest.value)} ms`}
        </strong>
        <span>{status}</span>
      </div>
      {result.ready ? (
        <>
          <ul className="legend health-legend" aria-label="Chart legend">
            <li>
              <i style={{ background: palette.hrv }} /> 7-day HRV
            </li>
            <li>
              <i className="range-swatch" /> Usual band
            </li>
            <li>
              <i className="median-swatch" /> 28-day mean
            </li>
          </ul>
          <HealthChart
            data={result.series}
            metric={{
              key: 'hrv7',
              label: '7-day HRV',
              short: '7-day HRV',
              unit: 'ms',
              decimals: 0,
              description: '',
              source: 'FORM',
            }}
            color={palette.hrv}
          />
          <dl className="detail-list analysis-list">
            <div>
              <dt>Usual band</dt>
              <dd>
                {Math.round(result.latest.low!)}–
                {Math.round(result.latest.high!)} ms
              </dd>
            </div>
            <div>
              <dt>7-day variability</dt>
              <dd>
                {result.cv == null ? dash : `${result.cv.toFixed(1)}% CV`}
              </dd>
            </div>
            <div>
              <dt>Days used</dt>
              <dd>
                {result.rollingCount} of {HRV_ROLLING} · {result.baselineCount}{' '}
                of {HRV_BASELINE}
              </dd>
            </div>
          </dl>
        </>
      ) : (
        <Needs>
          Needs at least 20 HRV readings in the last {HRV_BASELINE} days and 4
          in the last {HRV_ROLLING}. You have {result.baselineCount} and{' '}
          {result.rollingCount}.
        </Needs>
      )}
      <Method>
        <p>
          HRV is skewed, so each night is log-transformed before averaging and
          converted back to milliseconds; the line is therefore a geometric
          7-day mean. The band is the 28-day mean plus or minus half a standard
          deviation of the same log values, the “smallest worthwhile change”
          often used in sports science to decide whether a rolling average has
          really moved.
        </p>
        <p>
          A rolling average below the band, especially together with a rising
          day-to-day variability (the coefficient of variation), is commonly
          read as accumulated fatigue; above it, as adaptation. These are
          population heuristics. Your own history is the only reference used
          here, and WHOOP’s recovery score already folds HRV in.
        </p>
      </Method>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Trends and stability
// ---------------------------------------------------------------------------
const monthFormats: Record<string, (v: number) => string> = {
  recovery: (v) => `${Math.round(v)}%`,
  hrv: (v) => `${Math.round(v)} ms`,
  rhr: (v) => `${Math.round(v)} bpm`,
  sleepHours: duration,
  strain: (v) => v.toFixed(1),
  respiratoryRate: (v) => `${v.toFixed(1)} rpm`,
}
const monthEpsilons: Record<string, number> = {
  recovery: 0.5,
  hrv: 0.5,
  rhr: 0.5,
  sleepHours: 1 / 60,
  strain: 0.05,
  respiratoryRate: 0.05,
}

function MonthAgainstMonth({
  allDays,
  end,
}: {
  allDays: DailyStats[]
  end: string
}) {
  const result = monthAgainstMonth(allDays, end)
  return (
    <section className="panel">
      <Heading
        title="Month against month"
        description={`Medians, ${dateLabel(result.recentStart)}–${dateLabel(end)} against ${dateLabel(result.previousStart)}–${dateLabel(result.previousEnd)}`}
      />
      {result.ready ? (
        <ul className="review-list">
          {result.metrics.map((m) => {
            const format = monthFormats[m.key]
            const enough =
              m.recentCount >= MIN_MONTH_DAYS &&
              m.previousCount >= MIN_MONTH_DAYS
            return (
              <li key={m.key}>
                <span className="review-label">{m.label}</span>
                <strong>{m.recent == null ? dash : format(m.recent)}</strong>
                {enough ? (
                  <Delta
                    difference={
                      m.recent != null && m.previous != null
                        ? m.recent - m.previous
                        : null
                    }
                    better={m.better}
                    format={format}
                    epsilon={monthEpsilons[m.key]}
                    against="vs. prior month"
                  />
                ) : (
                  <span className="review-delta">
                    {m.recentCount} / {m.previousCount} days
                  </span>
                )}
                <span className="review-previous">
                  {m.previous == null ? dash : format(m.previous)}
                  <small>prior month</small>
                </span>
              </li>
            )
          })}
        </ul>
      ) : (
        <Needs>
          Needs at least {MIN_MONTH_DAYS} scored days in each 30-day window.
          History builds as you sync; the first sync imports 90 days.
        </Needs>
      )}
      <Method>
        <p>
          The median of each metric over the 30 days ending on the selected day,
          against the 30 days before that. Medians are used instead of averages
          so one unusual night does not move the month. Arrows are coloured by
          whether the direction is usually welcome (HRV up, resting heart rate
          down); strain and respiratory rate have no preferred direction.
        </p>
      </Method>
    </section>
  )
}

function Stability({
  allDays,
  end,
  range,
}: {
  allDays: DailyStats[]
  end: string
  range: number
}) {
  const rows = stability(allDays, end, range)
  const format = (row: (typeof rows)[number], value: number | null) =>
    value == null
      ? dash
      : row.relative
        ? `${value.toFixed(1)}%`
        : row.key === 'sleepHours'
          ? duration(value)
          : value.toFixed(1)
  return (
    <section className="panel">
      <Heading
        title="Day-to-day stability"
        description={`Spread over the last ${range} days against the ${range} before`}
      />
      <table className="analysis-table">
        <thead>
          <tr>
            <th scope="col">Metric</th>
            <th scope="col">This period</th>
            <th scope="col">Before</th>
            <th scope="col">Days</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <th scope="row">
                {row.label}
                <small>{row.relative ? 'CV' : 'SD'}</small>
              </th>
              <td>{format(row, row.current.value)}</td>
              <td>{format(row, row.previous.value)}</td>
              <td>
                {row.current.count} / {row.previous.count}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Method>
        <p>
          The sample standard deviation of each metric’s daily values (for HRV
          the coefficient of variation, i.e. SD as a share of the mean, because
          HRV scales with its level). Lower means your days looked more alike. A
          rising spread is worth a glance but is not good or bad by itself: a
          deliberately varied training week raises strain spread on purpose.
        </p>
      </Method>
    </section>
  )
}

function Highlights({
  days,
  workouts,
  range,
}: {
  days: DailyStats[]
  workouts: WhoopRecord[]
  range: number
}) {
  const best = highlights(days, workouts)
  const rows: { label: string; value: string; date: string | null }[] = [
    {
      label: 'Highest recovery',
      value: pct(best.highestRecovery?.recovery ?? null),
      date: best.highestRecovery?.date ?? null,
    },
    {
      label: 'Highest HRV',
      value:
        best.highestHrv?.hrv == null
          ? dash
          : `${Math.round(best.highestHrv.hrv)} ms`,
      date: best.highestHrv?.date ?? null,
    },
    {
      label: 'Lowest resting heart rate',
      value:
        best.lowestRhr?.rhr == null
          ? dash
          : `${Math.round(best.lowestRhr.rhr)} bpm`,
      date: best.lowestRhr?.date ?? null,
    },
    {
      label: 'Longest sleep',
      value: duration(best.longestSleep?.sleepHours),
      date: best.longestSleep?.date ?? null,
    },
    {
      label: 'Hardest day',
      value: num(best.hardestDay?.strain ?? null, 1),
      date: best.hardestDay?.date ?? null,
    },
    {
      label: 'Hardest session',
      value: best.hardestWorkout
        ? `${best.hardestWorkout.score!.strain!.toFixed(1)} · ${(best.hardestWorkout.sport_name ?? 'workout').replaceAll('_', ' ')}`
        : dash,
      date: best.hardestWorkout?.start
        ? localDate(
            best.hardestWorkout.start,
            best.hardestWorkout.timezone_offset,
          )
        : null,
    },
    {
      label: 'Longest session',
      value: best.longestWorkout
        ? `${duration(workoutHours(best.longestWorkout))} · ${(best.longestWorkout.sport_name ?? 'workout').replaceAll('_', ' ')}`
        : dash,
      date: best.longestWorkout?.start
        ? localDate(
            best.longestWorkout.start,
            best.longestWorkout.timezone_offset,
          )
        : null,
    },
  ]
  return (
    <section className="panel">
      <Heading
        title="Highlights"
        description={`Bests in the last ${range} days`}
      />
      <dl className="detail-list analysis-list highlights">
        {rows.map((row) => (
          <div key={row.label}>
            <dt>{row.label}</dt>
            <dd>
              {row.value}
              {row.date && <small> {dateLabel(row.date)}</small>}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Sleep
// ---------------------------------------------------------------------------
function SleepBalanceTrend({
  allDays,
  days,
  range,
}: {
  allDays: DailyStats[]
  days: DailyStats[]
  range: number
}) {
  const series = balanceSeries(allDays, days)
  const values = series
    .map((p) => p.hours)
    .filter((v): v is number => v != null)
  const extent = Math.max(1, ...values.map((v) => Math.abs(v)))
  const latest = series.at(-1)
  return (
    <section className="panel">
      <Heading
        title="Sleep balance"
        description={`Rolling 7-night total against need, last ${range} days`}
      />
      {values.length ? (
        <>
          <div className="chart-stat">
            <strong>
              {latest?.hours == null ? dash : signedHours(latest.hours)}
            </strong>
            <span>
              {latest?.hours == null
                ? 'no recent nights'
                : latest.hours < 0
                  ? 'short over the last 7 nights'
                  : 'ahead over the last 7 nights'}
            </span>
          </div>
          <div
            className="balance"
            role="img"
            aria-label={`Rolling 7-night sleep balance for ${values.length} days, from ${signedHours(Math.min(...values))} to ${signedHours(Math.max(...values))}.`}
          >
            <div className="balance-bars">
              {series.map((point) => (
                <span
                  key={point.date}
                  className="balance-slot"
                  title={
                    point.hours == null
                      ? `${dateLabel(point.date)}: no data`
                      : `${dateLabel(point.date)}: ${signedHours(point.hours)} over ${point.nights} nights`
                  }
                >
                  {point.hours != null && (
                    <i
                      className={point.hours < 0 ? 'short' : 'ahead'}
                      style={{
                        height: `${(Math.abs(point.hours) / extent) * 50}%`,
                      }}
                    />
                  )}
                </span>
              ))}
            </div>
            <div className="balance-axis">
              <span>{dateLabel(series[0].date)}</span>
              <span>{dateLabel(series.at(-1)!.date)}</span>
            </div>
          </div>
        </>
      ) : (
        <Needs>Needs nights with both time asleep and a sleep need.</Needs>
      )}
      <Method>
        <p>
          For each day, the sum of (time asleep minus WHOOP’s sleep need) over
          that night and the six before it. Bars above the line mean you slept
          more than WHOOP asked for across the week; below, less. WHOOP’s own
          sleep-debt figure folds this into the next night’s need, so the two
          will not match exactly.
        </p>
      </Method>
    </section>
  )
}

function SleepArchitecture({
  allDays,
  end,
  days,
  range,
}: {
  allDays: DailyStats[]
  end: string
  days: DailyStats[]
  range: number
}) {
  const rows = sleepArchitecture(allDays, end, days)
  const format = (row: (typeof rows)[number], value: number | null) =>
    value == null
      ? dash
      : row.unit === '%'
        ? `${value.toFixed(row.key === 'efficiency' ? 1 : 0)}%`
        : row.unit === 'min'
          ? `${Math.round(value)} min`
          : value.toFixed(1)
  return (
    <section className="panel">
      <Heading
        title="Sleep architecture"
        description={`Last 7 nights against the ${range}-day period`}
      />
      <table className="analysis-table">
        <thead>
          <tr>
            <th scope="col">Measure</th>
            <th scope="col">Last 7</th>
            <th scope="col">Period</th>
            <th scope="col">Nights</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <th scope="row">{row.label}</th>
              <td>{format(row, row.recent)}</td>
              <td>{format(row, row.period)}</td>
              <td>
                {row.recentCount} / {row.periodCount}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Method>
        <p>
          Stage shares are each stage’s time divided by total time asleep for
          that night, then averaged. Deep and REM shares drift with age,
          alcohol, late exercise, and sleep length, so compare a week with your
          own period rather than with textbook percentages. WHOOP’s stage
          detection is an estimate from heart rate and movement, not a sleep
          study.
        </p>
      </Method>
    </section>
  )
}

function Regularity({ days, range }: { days: DailyStats[]; range: number }) {
  const reg = regularity(days)
  const jet = socialJetlag(days)
  const wk = weekendVersusWeekday(days)
  return (
    <section className="panel">
      <Heading
        title="Regularity and social jetlag"
        description={`${reg.nights} nights in the last ${range} days`}
      />
      {reg.nights >= 7 ? (
        <dl className="detail-list analysis-list">
          <div>
            <dt>Bedtime within 30 min of your median</dt>
            <dd>{pct(reg.within30 == null ? null : reg.within30 * 100)}</dd>
          </div>
          <div>
            <dt>Within 60 min</dt>
            <dd>{pct(reg.within60 == null ? null : reg.within60 * 100)}</dd>
          </div>
          <div>
            <dt>Median bedtime</dt>
            <dd>
              {reg.medianBedtime == null
                ? dash
                : clockFromNight(reg.medianBedtime)}
            </dd>
          </div>
          <div>
            <dt>Social jetlag</dt>
            <dd>
              {jet.ready && jet.shift != null
                ? `${jet.shift >= 0 ? '+' : '−'}${Math.round(Math.abs(jet.shift))} min`
                : dash}
              <small>
                {jet.ready
                  ? ` weekend mid-sleep ${clockFromNight(jet.weekendMid!)} vs ${clockFromNight(jet.weekdayMid!)}`
                  : ` needs ${MIN_WEEKEND_NIGHTS} weekend nights, you have ${jet.weekendNights}`}
              </small>
            </dd>
          </div>
        </dl>
      ) : (
        <Needs>Needs at least 7 nights with bedtime and wake time.</Needs>
      )}
      <table className="analysis-table">
        <thead>
          <tr>
            <th scope="col">Weekend vs weekday</th>
            <th scope="col">Weekend</th>
            <th scope="col">Weekday</th>
            <th scope="col">Days</th>
          </tr>
        </thead>
        <tbody>
          {wk.map((row) => {
            const format =
              row.key === 'sleepHours'
                ? duration
                : row.key === 'recovery'
                  ? (v: number) => `${Math.round(v)}%`
                  : (v: number) => v.toFixed(1)
            return (
              <tr key={row.key}>
                <th scope="row">{row.label}</th>
                <td>{row.weekend == null ? dash : format(row.weekend)}</td>
                <td>{row.weekday == null ? dash : format(row.weekday)}</td>
                <td>
                  {row.weekendCount} / {row.weekdayCount}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <Method>
        <p>
          Regularity is the share of nights whose bedtime fell within 30 or 60
          minutes of your median bedtime for the period. Social jetlag is the
          difference between your average mid-sleep point (halfway between
          falling asleep and waking) on weekend nights and on weeknights, a
          standard measure of how far your weekend clock drifts. Weekend nights
          are those ending on Saturday or Sunday; it needs at least{' '}
          {MIN_WEEKEND_NIGHTS} of them.
        </p>
      </Method>
    </section>
  )
}

function GroupComparison({
  title,
  description,
  yesLabel,
  noLabel,
  result,
  formats,
  needs,
  method,
}: {
  title: string
  description: string
  yesLabel: string
  noLabel: string
  result: ReturnType<typeof napEffect>
  formats: Record<string, (v: number) => string>
  needs: string
  method: ReactNode
}) {
  return (
    <section className="panel">
      <Heading title={title} description={description} />
      {result.ready ? (
        <table className="analysis-table">
          <thead>
            <tr>
              <th scope="col">Outcome</th>
              <th scope="col">
                {yesLabel} <small>({result.yesCount})</small>
              </th>
              <th scope="col">
                {noLabel} <small>({result.noCount})</small>
              </th>
            </tr>
          </thead>
          <tbody>
            {result.outcomes.map((row) => (
              <tr key={row.key}>
                <th scope="row">{row.label}</th>
                <td>{row.yes == null ? dash : formats[row.key](row.yes)}</td>
                <td>{row.no == null ? dash : formats[row.key](row.no)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <Needs>
          {needs} You have {result.yesCount} and {result.noCount}.
        </Needs>
      )}
      <Method>{method}</Method>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Recovery dynamics
// ---------------------------------------------------------------------------
function BounceBack({ days, range }: { days: DailyStats[]; range: number }) {
  const result = bounceBack(days)
  return (
    <section className="panel">
      <Heading
        title="Bouncing back"
        description={`Days from a low recovery to the next high one, last ${range} days`}
      />
      {result.ready ? (
        <>
          <div className="chart-stat">
            <strong>
              {result.median} {result.median === 1 ? 'day' : 'days'}
            </strong>
            <span>typical, over {result.episodes.length} low days</span>
          </div>
          <ul className="episodes">
            {result.episodes.slice(-6).map((episode) => (
              <li key={episode.start}>
                <span>{dateLabel(episode.start)}</span>
                <i />
                <span>{dateLabel(episode.recovered)}</span>
                <strong>
                  {episode.days} {episode.days === 1 ? 'day' : 'days'}
                </strong>
              </li>
            ))}
          </ul>
          {result.censored > 0 && (
            <p className="detail-copy">
              {result.censored} low{' '}
              {result.censored === 1 ? 'day has' : 'days have'} not yet been
              followed by a high one and {result.censored === 1 ? 'is' : 'are'}{' '}
              left out.
            </p>
          )}
        </>
      ) : (
        <Needs>
          Needs at least {MIN_EPISODES} low-recovery days (under 34%) that were
          later followed by a high one (67% or more). You have{' '}
          {result.episodes.length}.
        </Needs>
      )}
      <Method>
        <p>
          Every day with recovery under 34% starts an episode; it ends on the
          first later day at 67% or more, and the count is calendar days between
          them. The headline is the median across episodes. Low days that have
          not yet been followed by a high day are reported separately rather
          than counted as zero.
        </p>
      </Method>
    </section>
  )
}

function HardDays({
  allDays,
  days,
  range,
}: {
  allDays: DailyStats[]
  days: DailyStats[]
  range: number
}) {
  const result = hardDaySequences(allDays, days)
  return (
    <section className="panel">
      <Heading
        title="Hard days in a row"
        description={`Recovery the morning after strain of ${HARD_STRAIN}+, last ${range} days`}
      />
      {result.ready ? (
        <dl className="detail-list analysis-list">
          <div>
            <dt>After two or more hard days</dt>
            <dd>
              {pct(result.afterRuns.recovery)}
              <small> {result.afterRuns.count} mornings</small>
            </dd>
          </div>
          <div>
            <dt>After a single hard day</dt>
            <dd>
              {pct(result.afterSingles.recovery)}
              <small> {result.afterSingles.count} mornings</small>
            </dd>
          </div>
        </dl>
      ) : (
        <Needs>
          Needs at least 4 mornings after a run of two or more hard days and 4
          after a single hard day. You have {result.afterRuns.count} and{' '}
          {result.afterSingles.count}.
        </Needs>
      )}
      <Method>
        <p>
          A hard day is day strain of {HARD_STRAIN} or more. The first non-hard
          day after a run of hard days contributes its recovery score to one of
          two groups depending on whether the run was one day or longer. Small
          groups swing a lot, so this stays hidden until each has four mornings.
        </p>
      </Method>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Training
// ---------------------------------------------------------------------------
function Monotony({ allDays, end }: { allDays: DailyStats[]; end: string }) {
  const result = monotony(allDays, end)
  const week = (
    label: string,
    value: ReturnType<typeof monotony>['current'],
  ) => (
    <div className="monotony-week">
      <h5>{label}</h5>
      <dl className="detail-list analysis-list">
        <div>
          <dt>Weekly load</dt>
          <dd>
            {value.load.toFixed(1)}
            <small> strain over {value.days} days</small>
          </dd>
        </div>
        <div>
          <dt>Monotony</dt>
          <dd>
            {num(value.monotony, 2)}
            <small> {monotonyLabel(value.monotony)}</small>
          </dd>
        </div>
        <div>
          <dt>Training strain</dt>
          <dd>{num(value.trainingStrain, 0)}</dd>
        </div>
      </dl>
    </div>
  )
  return (
    <section className="panel">
      <Heading
        title="Weekly monotony"
        description={`Foster’s load, monotony, and strain for the week ending ${dateLabel(end)}`}
      />
      <div className="monotony">
        {week('This week', result.current)}
        {week('Week before', result.previous)}
      </div>
      <Method>
        <p>
          Load is the sum of daily strain over seven days. Monotony is the mean
          daily strain divided by its standard deviation: a week of similar days
          scores high, a week that mixes hard and easy days scores low. Training
          strain is load times monotony. In Foster’s original work with
          athletes, monotony above 2 and spikes in training strain preceded
          illness and overtraining more often than load alone. It needs at least
          five scored days and some variation; a perfectly even week has no
          defined value.
        </p>
      </Method>
    </section>
  )
}

function Zones({
  workouts,
  range,
}: {
  workouts: WhoopRecord[]
  range: number
}) {
  const result = zoneTotals(workouts)
  const labels = ['Zone 0', 'Zone 1', 'Zone 2', 'Zone 3', 'Zone 4', 'Zone 5']
  const max = Math.max(...result.hours, 0)
  return (
    <section className="panel">
      <Heading
        title="Time in heart-rate zones"
        description={`${result.sessions} ${result.sessions === 1 ? 'session' : 'sessions'} with zone data in the last ${range} days`}
      />
      {result.sessions ? (
        <>
          <div className="chart-stat">
            <strong>
              {pct(result.easy == null ? null : result.easy * 100)}
            </strong>
            <span>
              easy ·{' '}
              {pct(result.moderate == null ? null : result.moderate * 100)}{' '}
              moderate · {pct(result.hard == null ? null : result.hard * 100)}{' '}
              hard
            </span>
          </div>
          <ol className="zone-totals">
            {result.hours.map((hours, index) => (
              <li key={index}>
                <span>{labels[index]}</span>
                <span className="zone-track" aria-hidden="true">
                  <span
                    style={{
                      width: `${max ? (hours / max) * 100 : 0}%`,
                      background: `color-mix(in srgb, var(--c-strain) ${30 + index * 14}%, var(--surface-3))`,
                    }}
                  />
                </span>
                <strong>{duration(hours)}</strong>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <Needs>No sessions with heart-rate zone data in this period.</Needs>
      )}
      <Method>
        <p>
          Zone minutes are summed across every scored session in the period.
          WHOOP’s zones are bands of your maximum heart rate: zone 0 below 50%,
          then 50–60, 60–70, 70–80, 80–90, and 90–100. Easy here is zones 0–2,
          moderate is zone 3, hard is zones 4–5. Endurance coaching often aims
          for most time easy and a smaller share hard, but the right mix depends
          on the sport and the season.
        </p>
      </Method>
    </section>
  )
}

function MorningAfter({
  allDays,
  workouts,
  range,
}: {
  allDays: DailyStats[]
  workouts: WhoopRecord[]
  range: number
}) {
  const result = morningAfterBySport(allDays, workouts)
  return (
    <section className="panel">
      <Heading
        title="The morning after, by sport"
        description={`Sports with ${MIN_SPORT_SESSIONS}+ sessions in the last ${range} days`}
      />
      {result.ready ? (
        <table className="analysis-table">
          <thead>
            <tr>
              <th scope="col">Sport</th>
              <th scope="col">Sessions</th>
              <th scope="col">Recovery next morning</th>
              <th scope="col">Sleep performance</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row) => (
              <tr key={row.sport}>
                <th scope="row" className="capitalize">
                  {row.sport}
                </th>
                <td>{row.sessions}</td>
                <td>{pct(row.recovery)}</td>
                <td>{pct(row.sleepPerformance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <Needs>
          Needs at least two sports with {MIN_SPORT_SESSIONS} sessions each
          followed by a scored morning. You have {result.rows.length}.
        </Needs>
      )}
      <Method>
        <p>
          Each session is matched with the physiological day that starts with
          the following night’s sleep, so “next morning” is the recovery and
          sleep performance reported after that sleep. Sports are averaged
          separately. Differences between sports mix in everything else about
          those days, including how hard the session was.
        </p>
      </Method>
    </section>
  )
}

function Coverage({
  days,
  records,
  end,
  range,
}: {
  days: DailyStats[]
  records: StoredRecord[]
  end: string
  range: number
}) {
  const c = coverage(days, records, end, range)
  const rows = [
    ['Days with a cycle', `${c.days} of ${c.expected}`],
    ['Missing days', String(c.missing)],
    ['Recovery scored', `${c.recoveryScored} of ${c.days}`],
    ['Recovery pending', String(c.recoveryPending)],
    ['Calibrating', String(c.calibrating)],
    ['Main sleep scored', `${c.sleepScored} of ${c.days}`],
    ['Unscorable sleeps', String(c.unscorableSleeps)],
    ['Naps', String(c.naps)],
    ['Workouts', String(c.workouts)],
    ['HRV readings', `${c.hrvDays} of ${c.days}`],
    ['Blood oxygen readings', `${c.spo2Days} of ${c.days}`],
  ]
  return (
    <section className="panel">
      <Heading
        title="Data coverage"
        description={`What the last ${range} days contain, so you know how much to trust the panels above`}
      />
      <dl className="detail-list analysis-list coverage">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <Method>
        <p>
          A missing day means WHOOP returned no physiological cycle for that
          date, usually because the strap was off. Pending scores are cycles
          WHOOP has not finished processing; calibrating days are the first days
          after joining, which WHOOP excludes from its own comparisons and this
          dashboard excludes from baselines.
        </p>
      </Method>
    </section>
  )
}

// ---------------------------------------------------------------------------
export function InsightsSection({
  allDays,
  days,
  current,
  end,
  range,
  workouts,
  records,
}: {
  allDays: DailyStats[]
  days: DailyStats[]
  current: DailyStats | undefined
  end: string
  range: number
  workouts: WhoopRecord[]
  records: StoredRecord[]
}) {
  if (!current)
    return (
      <section className="panel">
        <p className="empty">Insights appear after your first sync.</p>
      </section>
    )
  const napResult = napEffect(allDays, days, records)
  const eveningResult = eveningSessions(allDays, days, workouts)
  return (
    <div className="analysis">
      <p className="analysis-intro">
        Every panel below is computed only from your own recorded days, shows
        how many days it rests on, and stays hidden until it has enough. They
        describe patterns; they do not diagnose, predict, or prescribe.
      </p>

      <Group
        title="Relationships"
        intro="Which of last night’s and yesterday’s numbers moved together with this morning’s."
      >
        <div className="grid-secondary single">
          <Relationships allDays={allDays} days={days} range={range} />
        </div>
      </Group>

      <Group
        title="Nightly signals"
        intro="Your own recent nights as the only reference."
      >
        <div className="grid-secondary">
          <UnusualNights allDays={allDays} days={days} range={range} />
          <HrvReadiness allDays={allDays} end={end} range={range} />
        </div>
      </Group>

      <Group
        title="Trends and stability"
        intro="Slower movements that a single week hides."
      >
        <div className="grid-secondary">
          <MonthAgainstMonth allDays={allDays} end={end} />
          <Stability allDays={allDays} end={end} range={range} />
        </div>
      </Group>

      <Group
        title="Sleep"
        intro="Balance, structure, and timing across the period."
      >
        <div className="grid-secondary">
          <SleepBalanceTrend allDays={allDays} days={days} range={range} />
          <SleepArchitecture
            allDays={allDays}
            end={end}
            days={days}
            range={range}
          />
        </div>
        <div className="grid-secondary">
          <Regularity days={days} range={range} />
          <GroupComparison
            title="Naps and the next morning"
            description={`Days with a nap against days without, last ${range} days`}
            yesLabel="With a nap"
            noLabel="Without"
            result={napResult}
            formats={{
              recovery: (v) => `${Math.round(v)}%`,
              sleep: duration,
              need: duration,
            }}
            needs={`Needs at least ${MIN_GROUP} nap days and ${MIN_GROUP} nap-free days followed by a scored morning.`}
            method={
              <p>
                A day counts as a nap day when WHOOP recorded a nap ending on
                that date. The comparison looks at the following night and
                morning: time asleep, WHOOP’s sleep need for that night (which
                already subtracts nap credit), and recovery. Naps are usually
                taken on tired days, so a lower next-morning recovery after naps
                is expected and says little about the nap itself.
              </p>
            }
          />
        </div>
      </Group>

      <Group
        title="Recovery dynamics"
        intro="How quickly you come back, and what consecutive hard days cost."
      >
        <div className="grid-secondary">
          <BounceBack days={days} range={range} />
          <HardDays allDays={allDays} days={days} range={range} />
        </div>
      </Group>

      <Group
        title="Training"
        intro="Load shape, intensity mix, and what different sessions are followed by."
      >
        <div className="grid-secondary">
          <Monotony allDays={allDays} end={end} />
          <Zones workouts={workouts} range={range} />
        </div>
        <div className="grid-secondary">
          <MorningAfter allDays={allDays} workouts={workouts} range={range} />
          <GroupComparison
            title="Evening sessions"
            description={`Session days ending after 7 PM against earlier sessions, last ${range} days`}
            yesLabel="Evening"
            noLabel="Earlier"
            result={eveningResult}
            formats={{
              efficiency: (v) => `${v.toFixed(1)}%`,
              performance: (v) => `${Math.round(v)}%`,
              recovery: (v) => `${Math.round(v)}%`,
            }}
            needs={`Needs at least ${MIN_GROUP} days with an evening session and ${MIN_GROUP} with only earlier sessions.`}
            method={
              <p>
                Only days with at least one session are compared, so rest days
                do not blur the picture. A session counts as evening when it
                ends at or after 7 PM in the recorded timezone. Outcomes are
                that night’s sleep efficiency and performance and the next
                morning’s recovery. Evening sessions are often the longer or
                harder ones; that, not the clock, may be what you see.
              </p>
            }
          />
        </div>
      </Group>

      <Group
        title="Reference"
        intro="Bests in the period and how complete the data is."
      >
        <div className="grid-secondary">
          <Highlights days={days} workouts={workouts} range={range} />
          <Coverage days={days} records={records} end={end} range={range} />
        </div>
      </Group>
    </div>
  )
}
