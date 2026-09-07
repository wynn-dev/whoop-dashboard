import type { ReactNode } from 'react'
import { MoveDownRight, MoveUpRight } from 'lucide-react'
import {
  byWeekday,
  clockFromNight,
  enoughVariety,
  loadLabel,
  MIN_BUCKET_DAYS,
  recoveryByPriorStrain,
  recoveryBySleepNeed,
  recoveryMix,
  sleepBalance,
  sleepTiming,
  sportBreakdown,
  streak,
  trainingLoad,
  volume,
  weekInReview,
  workoutsThrough,
  type Bucket,
  type Direction,
  type MetricKey,
  type WeekMetric,
} from '@/lib/insights'
import {
  duration,
  shiftDate,
  type DailyStats,
  type WhoopRecord,
} from '@/lib/whoop'
import { palette, recoveryTone } from '@/lib/palette'
import { cn } from '@/lib/utils'

const dateLabel = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString('en', {
    month: 'short',
    day: 'numeric',
  })
const kcal = (value: number | null) =>
  value == null ? '—' : `${Math.round(value).toLocaleString()} kcal`
const signedDuration = (hours: number) =>
  `${hours < -1 / 120 ? '−' : hours > 1 / 120 ? '+' : ''}${duration(Math.abs(hours))}`

function Heading({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="panel-heading">
      <div>
        <h3>{title}</h3>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  )
}

function Delta({
  difference,
  better,
  format,
  epsilon,
  against,
}: {
  difference: number | null
  better: Direction
  format: (value: number) => string
  epsilon: number
  against: string
}) {
  if (difference == null)
    return <span className="review-delta">No comparison</span>
  if (Math.abs(difference) < epsilon)
    return <span className="review-delta">Unchanged</span>
  const tone =
    better === 'neutral'
      ? undefined
      : difference > 0 === (better === 'up')
        ? 'good'
        : 'watch'
  return (
    <span className={cn('review-delta', tone)}>
      {difference > 0 ? (
        <MoveUpRight size={13} aria-hidden />
      ) : (
        <MoveDownRight size={13} aria-hidden />
      )}
      {difference > 0 ? '+' : '−'}
      {format(Math.abs(difference))} {against}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------
const weekFormats: Record<WeekMetric['key'], (value: number) => string> = {
  recovery: (v) => `${Math.round(v)}%`,
  sleepHours: duration,
  strain: (v) => v.toFixed(1),
  hrv: (v) => `${Math.round(v)} ms`,
  rhr: (v) => `${Math.round(v)} bpm`,
}
const weekEpsilons: Record<WeekMetric['key'], number> = {
  recovery: 0.5,
  sleepHours: 1 / 60,
  strain: 0.05,
  hrv: 0.5,
  rhr: 0.5,
}

export function WeekReview({
  allDays,
  end,
}: {
  allDays: DailyStats[]
  end: string
}) {
  const review = weekInReview(allDays, end)
  return (
    <section className="panel">
      <Heading
        title="Week in review"
        description={`${dateLabel(review.start)}–${dateLabel(review.end)} against ${dateLabel(review.previousStart)}–${dateLabel(review.previousEnd)}`}
      />
      <ul className="review-list">
        {review.metrics.map((metric) => {
          const format = weekFormats[metric.key]
          return (
            <li key={metric.key}>
              <span className="review-label">{metric.label}</span>
              <strong>
                {metric.current == null ? '—' : format(metric.current)}
              </strong>
              <Delta
                difference={
                  metric.current != null && metric.previous != null
                    ? metric.current - metric.previous
                    : null
                }
                better={metric.better}
                format={format}
                epsilon={weekEpsilons[metric.key]}
                against="vs. week before"
              />
              <span className="review-previous">
                {metric.previous == null ? '—' : format(metric.previous)}
                <small>week before</small>
              </span>
            </li>
          )
        })}
      </ul>
      <div className="panel-foot">
        <span>Averages of scored days in each 7-day window</span>
      </div>
    </section>
  )
}

const weekdayOf = (date: string) =>
  (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7
const longDate = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString('en', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })

export function RecoveryHeatmap({
  days,
  current,
  end,
  range,
  onSelect,
}: {
  days: DailyStats[]
  current: DailyStats | undefined
  end: string
  range: number
  onSelect: (cycleId: string) => void
}) {
  const mix = recoveryMix(days)
  const byDate = new Map(days.map((day) => [day.date, day]))
  const first = shiftDate(end, 1 - range)
  const start = shiftDate(first, -weekdayOf(first))
  const weeks: string[][] = []
  for (let date = start; date <= end; date = shiftDate(date, 1)) {
    if (weekdayOf(date) === 0 || !weeks.length) weeks.push([])
    weeks.at(-1)!.push(date)
  }
  const monthLabels = weeks.map((week, index) =>
    index === 0 || week[0].slice(0, 7) !== weeks[index - 1][0].slice(0, 7)
      ? new Date(`${week[week.length - 1]}T12:00:00`).toLocaleDateString('en', {
          month: 'short',
        })
      : '',
  )
  const highStreak = streak(days, end, (day) => (day.recovery ?? 0) >= 67)
  const legend = [
    { label: 'High', count: mix.high, color: recoveryTone(80).color },
    { label: 'Moderate', count: mix.moderate, color: recoveryTone(50).color },
    { label: 'Low', count: mix.low, color: recoveryTone(20).color },
    { label: 'Unscored', count: mix.unscored, color: palette.none },
  ].filter((segment) => segment.count > 0)
  return (
    <section className="panel">
      <Heading
        title="Recovery, day by day"
        description={`${mix.scored} scored ${mix.scored === 1 ? 'day' : 'days'} in the last ${range}`}
      />
      {mix.total ? (
        <div className="heat-wrap">
          <div className="heat" data-dense={range > 35 || undefined}>
            <div className="heat-weekdays" aria-hidden="true">
              {['Mon', '', 'Wed', '', 'Fri', '', 'Sun'].map((label, i) => (
                <span key={i}>{label}</span>
              ))}
            </div>
            <div
              className="heat-grid"
              role="group"
              aria-label="Recovery by day"
            >
              <div className="heat-months" aria-hidden="true">
                {monthLabels.map((label, index) => (
                  <span key={index}>{label}</span>
                ))}
              </div>
              <div className="heat-weeks">
                {weeks.map((week, index) => (
                  <div className="heat-week" key={index}>
                    {week.map((date) => {
                      const day = byDate.get(date)
                      if (date < first || date > end)
                        return <span className="heat-cell outside" key={date} />
                      if (!day) return <span className="heat-cell" key={date} />
                      const tone = recoveryTone(day.recovery)
                      const selected = day.cycleId === current?.cycleId
                      return (
                        <button
                          key={date}
                          className="heat-cell"
                          data-selected={selected || undefined}
                          style={{ background: tone.color }}
                          aria-label={`${longDate(date)}, ${day.recovery == null ? 'not scored' : `recovery ${Math.round(day.recovery)}%`}`}
                          aria-pressed={selected}
                          title={`${longDate(date)} · ${day.recovery == null ? 'Not scored' : `${Math.round(day.recovery)}% ${tone.label.toLowerCase()}`}`}
                          onClick={() => onSelect(day.cycleId)}
                        />
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <ul className="mix-legend">
            {legend.map((segment) => (
              <li key={segment.label}>
                <i style={{ background: segment.color }} />
                <span>{segment.label}</span>
                <strong>{segment.count}</strong>
                <small>{Math.round((segment.count / mix.total) * 100)}%</small>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="empty">No days in this period yet.</p>
      )}
      <div className="panel-foot">
        <span>
          {highStreak.current
            ? `${highStreak.current} ${highStreak.current === 1 ? 'day' : 'days'} high in a row`
            : 'No current high-recovery streak'}
          {highStreak.longest > 1 ? ` · longest ${highStreak.longest}` : ''}
        </span>
        <span>Tap a day to open it</span>
      </div>
    </section>
  )
}

const weekdayMetrics: Record<
  'recovery' | 'strain' | 'sleepHours',
  { title: string; color: string; format: (value: number) => string }
> = {
  recovery: {
    title: 'Recovery by weekday',
    color: palette.recovery,
    format: (v) => `${Math.round(v)}%`,
  },
  strain: {
    title: 'Strain by weekday',
    color: palette.strain,
    format: (v) => v.toFixed(1),
  },
  sleepHours: {
    title: 'Time asleep by weekday',
    color: palette.sleep,
    format: duration,
  },
}

export function WeekdayPattern({
  days,
  current,
  metric,
  range,
}: {
  days: DailyStats[]
  current: DailyStats | undefined
  metric: keyof typeof weekdayMetrics
  range: number
}) {
  const { title, color, format } = weekdayMetrics[metric]
  const pattern = byWeekday(days, metric as MetricKey)
  const scored = pattern.reduce((sum, item) => sum + item.count, 0)
  const enough = range >= 14 && pattern.every((item) => item.count >= 2)
  const max = Math.max(...pattern.map((item) => item.average ?? 0), 0)
  const today = current ? weekdayOf(current.date) : -1
  return (
    <section className="panel">
      <Heading
        title={title}
        description={`Average across ${scored} scored ${scored === 1 ? 'day' : 'days'} in the last ${range}`}
      />
      {enough ? (
        <div
          className="weekdays"
          role="img"
          aria-label={pattern
            .map(
              (item) =>
                `${item.label} ${item.average == null ? 'no data' : format(item.average)}`,
            )
            .join(', ')}
        >
          {pattern.map((item, index) => (
            <div
              className="weekday"
              key={item.label}
              data-selected={index === today || undefined}
              title={`${item.label}: ${item.average == null ? 'no data' : format(item.average)} over ${item.count} days`}
            >
              <span className="weekday-value">
                {item.average == null ? '—' : format(item.average)}
              </span>
              <span className="weekday-track">
                <span
                  style={{
                    height: `${max ? ((item.average ?? 0) / max) * 100 : 0}%`,
                    background: color,
                  }}
                />
              </span>
              <span className="weekday-label">{item.label}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="empty">
          Weekday patterns need at least two weeks with every weekday scored
          twice. Try the 30- or 90-day view.
        </p>
      )}
      <div className="panel-foot">
        <span>
          Same weekday, averaged. A pattern here is descriptive, not a rule.
        </span>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Recovery
// ---------------------------------------------------------------------------
function BucketList({ buckets }: { buckets: Bucket[] }) {
  if (!enoughVariety(buckets))
    return (
      <p className="empty">
        Not enough variety yet. Each group needs at least {MIN_BUCKET_DAYS} days
        in this period.
      </p>
    )
  return (
    <ul className="buckets">
      {buckets.map((bucket) => (
        <li
          key={bucket.label}
          className={cn(bucket.count < MIN_BUCKET_DAYS && 'thin')}
        >
          <span className="bucket-label">
            {bucket.label}
            <small>
              {bucket.detail} · {bucket.count}{' '}
              {bucket.count === 1 ? 'day' : 'days'}
            </small>
          </span>
          <span className="bucket-track" aria-hidden="true">
            <span
              style={{
                width: `${bucket.average ?? 0}%`,
                background: recoveryTone(bucket.average).color,
              }}
            />
          </span>
          <strong>
            {bucket.average == null ? '—' : `${Math.round(bucket.average)}%`}
          </strong>
        </li>
      ))}
    </ul>
  )
}

export function RecoveryDrivers({
  allDays,
  days,
  range,
}: {
  allDays: DailyStats[]
  days: DailyStats[]
  range: number
}) {
  return (
    <section className="panel">
      <Heading
        title="What moves your recovery"
        description={`Average recovery in the last ${range} days, grouped by what came before it`}
      />
      <div className="driver-groups">
        <div className="driver-group">
          <h4>By last night’s sleep</h4>
          <p>Time asleep as a share of the sleep WHOOP said you needed</p>
          <BucketList buckets={recoveryBySleepNeed(days)} />
        </div>
        <div className="driver-group">
          <h4>By the previous day’s strain</h4>
          <p>Day strain on the day before each recovery score</p>
          <BucketList buckets={recoveryByPriorStrain(allDays, days)} />
        </div>
      </div>
      <div className="panel-foot">
        <span>
          Descriptive averages of your own days. They show patterns, not causes.
        </span>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Sleep
// ---------------------------------------------------------------------------
export function SleepTiming({
  days,
  current,
  end,
  range,
}: {
  days: DailyStats[]
  current: DailyStats | undefined
  end: string
  range: number
}) {
  const timing = sleepTiming(days)
  const balance = sleepBalance(days, end)
  const { nights } = timing
  if (!nights.length)
    return (
      <section className="panel">
        <Heading title="Sleep timing" />
        <p className="empty">Bedtimes appear once main sleeps are synced.</p>
      </section>
    )
  const min = Math.floor(Math.min(...nights.map((n) => n.bed)) / 60) * 60
  const max = Math.ceil(Math.max(...nights.map((n) => n.wake)) / 60) * 60
  const position = (minutes: number) => ((minutes - min) / (max - min)) * 100
  const ticks: number[] = []
  for (let t = min; t <= max; t += 120) ticks.push(t)
  const rowHeight = Math.max(3, Math.min(10, Math.floor(240 / nights.length)))
  const gap = rowHeight >= 6 ? 3 : 1
  return (
    <section className="panel">
      <Heading
        title="Sleep timing"
        description={`${nights.length} ${nights.length === 1 ? 'night' : 'nights'} in the last ${range} days`}
      />
      <dl className="detail-stats timing-stats">
        <div>
          <dt>Average bedtime</dt>
          <dd>
            {clockFromNight(timing.bedtime!)}
            {timing.bedtimeSpread != null && (
              <small> ± {Math.round(timing.bedtimeSpread)} min</small>
            )}
          </dd>
        </div>
        <div>
          <dt>Average wake time</dt>
          <dd>
            {clockFromNight(timing.wake!)}
            {timing.wakeSpread != null && (
              <small> ± {Math.round(timing.wakeSpread)} min</small>
            )}
          </dd>
        </div>
        <div>
          <dt>Last {balance.count || 7} nights vs. need</dt>
          <dd>
            {balance.count ? signedDuration(balance.hours) : '—'}
            <small> {balance.hours < 0 ? 'short' : 'ahead'}</small>
          </dd>
        </div>
      </dl>
      <div className="timing">
        <div className="timing-axis" aria-hidden="true">
          {ticks.map((tick) => (
            <span key={tick} style={{ left: `${position(tick)}%` }}>
              {clockFromNight(tick)}
            </span>
          ))}
        </div>
        <div
          className="timing-rows"
          role="img"
          aria-label={`Bedtime and wake time for ${nights.length} nights. Average bedtime ${clockFromNight(timing.bedtime!)}, average wake ${clockFromNight(timing.wake!)}.`}
        >
          {ticks.map((tick) => (
            <i
              key={tick}
              className="timing-grid"
              style={{ left: `${position(tick)}%` }}
            />
          ))}
          <i
            className="timing-mark"
            style={{ left: `${position(timing.bedtime!)}%` }}
          />
          <i
            className="timing-mark"
            style={{ left: `${position(timing.wake!)}%` }}
          />
          {nights.map((night) => (
            <div
              key={night.date}
              className="timing-row"
              data-selected={night.date === current?.date || undefined}
              style={{ height: rowHeight, marginBottom: gap }}
              title={`${dateLabel(night.date)}: ${clockFromNight(night.bed)} – ${clockFromNight(night.wake)}, ${duration(night.sleepHours)} asleep`}
            >
              <span
                className="timing-bar"
                style={{
                  left: `${position(night.bed)}%`,
                  width: `${position(night.wake) - position(night.bed)}%`,
                }}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="panel-foot">
        <span>
          Main sleep in the recorded timezone, oldest night first · ± is one
          standard deviation
        </span>
        <span>Naps excluded</span>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Activity
// ---------------------------------------------------------------------------
export function TrainingLoad({
  allDays,
  end,
  workouts,
}: {
  allDays: DailyStats[]
  end: string
  workouts: WhoopRecord[]
}) {
  const load = trainingLoad(allDays, end)
  const week = volume(workoutsThrough(workouts, end, 7))
  const strain = (value: number | null) =>
    value == null ? '—' : value.toFixed(1)
  return (
    <section className="panel">
      <Heading
        title="Training load"
        description={`Average day strain through ${dateLabel(end)}`}
      />
      <dl className="detail-stats load-stats">
        <div>
          <dt>7-day average</dt>
          <dd>
            {strain(load.acute)}
            <small>
              {' '}
              {load.acuteCount} {load.acuteCount === 1 ? 'day' : 'days'}
            </small>
          </dd>
        </div>
        <div>
          <dt>28-day average</dt>
          <dd>
            {strain(load.chronic)}
            <small>
              {' '}
              {load.chronicCount} {load.chronicCount === 1 ? 'day' : 'days'}
            </small>
          </dd>
        </div>
        <div>
          <dt>Load trend</dt>
          <dd className="load-trend">
            {loadLabel(load.ratio)}
            <small>
              {' '}
              {load.ratio != null
                ? `${load.ratio.toFixed(2)}× the 28-day average`
                : `${load.chronicCount} of 14 days needed`}
            </small>
          </dd>
        </div>
        <div>
          <dt>This week</dt>
          <dd className="load-week">
            {week.sessions} {week.sessions === 1 ? 'session' : 'sessions'}
            <small>
              {' '}
              · {duration(week.hours)} · {kcal(week.calories)}
            </small>
          </dd>
        </div>
      </dl>
      <div className="panel-foot">
        <span>
          Ramping up is above 1.15×, backing off is below 0.85×. Descriptive
          only, not a training plan.
        </span>
      </div>
    </section>
  )
}

export function SportBreakdown({
  workouts,
  range,
}: {
  workouts: WhoopRecord[]
  range: number
}) {
  const sports = sportBreakdown(workouts)
  const longest = Math.max(...sports.map((sport) => sport.hours), 0)
  return (
    <section className="panel">
      <Heading
        title="By sport"
        description={`${workouts.length} ${workouts.length === 1 ? 'session' : 'sessions'} in the last ${range} days`}
      />
      {sports.length ? (
        <div className="table-scroll flush">
          <table className="sport-table">
            <thead>
              <tr>
                <th scope="col">Sport</th>
                <th scope="col">Sessions</th>
                <th scope="col">Time</th>
                <th scope="col">Avg strain</th>
                <th scope="col">Energy</th>
              </tr>
            </thead>
            <tbody>
              {sports.map((sport) => (
                <tr key={sport.sport}>
                  <th scope="row">
                    <span className="sport-name">{sport.sport}</span>
                    <span className="sport-share" aria-hidden="true">
                      <span
                        style={{
                          width: `${longest ? (sport.hours / longest) * 100 : 0}%`,
                        }}
                      />
                    </span>
                  </th>
                  <td>{sport.sessions}</td>
                  <td>{duration(sport.hours)}</td>
                  <td>
                    {sport.strain == null ? '—' : sport.strain.toFixed(1)}
                  </td>
                  <td>{kcal(sport.calories)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="empty">No sessions in this period.</p>
      )}
      <div className="panel-foot">
        <span>Time is elapsed session time, sorted by total time</span>
      </div>
    </section>
  )
}
