import { ChevronDown, Moon } from 'lucide-react'
import {
  duration,
  localTime,
  napsOnDate,
  sleepDuration,
  type DailyStats,
  type StoredRecord,
} from '@/lib/whoop'

const number = (value: number | null | undefined) =>
  value == null ? '—' : String(value)
const contribution = (value: number | null | undefined) =>
  value == null
    ? '—'
    : `${value > 0 ? '+' : value < 0 ? '−' : ''}${duration(Math.abs(value))}`

export function SleepDetails({
  day,
  records,
}: {
  day: DailyStats | undefined
  records: StoredRecord[]
}) {
  const naps = day ? napsOnDate(records, day.date) : []
  const rows = [
    {
      label: 'Baseline sleep need',
      value: day?.sleepBaselineHours,
      note: 'Your sleep need before adjustments',
    },
    {
      label: 'Sleep debt',
      value: day?.sleepDebtHours,
      note: 'Additional need from previous sleep',
    },
    {
      label: 'Recent strain',
      value: day?.sleepStrainHours,
      note: 'Additional need from activity',
    },
    {
      label: 'Recent nap credit',
      value: day?.sleepNapCreditHours,
      note: 'WHOOP’s reduction in sleep need',
    },
  ]
  return (
    <>
      <div className="grid-secondary sleep-detail-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>Why this much sleep?</h3>
              <p>WHOOP’s sleep-need breakdown for the selected night</p>
            </div>
          </div>
          <dl className="detail-list sleep-need-list">
            {rows.map((row, index) => (
              <div key={row.label}>
                <dt>
                  {row.label}
                  <small>{row.note}</small>
                </dt>
                <dd>
                  {index === 0 ? duration(row.value) : contribution(row.value)}
                </dd>
              </div>
            ))}
          </dl>
          <div className="panel-foot">
            <span>Total sleep needed</span>
            <strong>{duration(day?.sleepNeededHours)}</strong>
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>Sleep continuity</h3>
              <p>
                Stage totals and recording quality, not a sleep-stage timeline
              </p>
            </div>
          </div>
          <dl className="detail-stats">
            <div>
              <dt>Time in bed</dt>
              <dd>{duration(day?.inBedHours)}</dd>
            </div>
            <div>
              <dt>Time awake</dt>
              <dd>{duration(day?.awakeHours)}</dd>
            </div>
            <div>
              <dt>Disturbances</dt>
              <dd>{number(day?.disturbanceCount)}</dd>
            </div>
            <div>
              <dt>Sleep cycles</dt>
              <dd>{number(day?.sleepCycleCount)}</dd>
            </div>
            <div>
              <dt>Without sensor data</dt>
              <dd>{duration(day?.noDataHours)}</dd>
            </div>
            <div>
              <dt>Sleep efficiency</dt>
              <dd>
                {day?.sleepEfficiency == null
                  ? '—'
                  : `${day.sleepEfficiency.toFixed(1)}%`}
              </dd>
            </div>
          </dl>
          <div className="panel-foot">
            <span>
              {day?.sleepState === 'SCORED'
                ? 'Missing fields mean not returned by WHOOP'
                : day?.sleepState === 'UNSCORABLE'
                  ? 'WHOOP could not score this sleep'
                  : 'Awaiting a scored sleep record'}
            </span>
          </div>
        </section>
      </div>
      <section className="panel naps-panel">
        <div className="panel-heading">
          <div>
            <h3>Naps</h3>
            <p>Selected day · kept separate from your main sleep</p>
          </div>
          <span className="pill">
            {naps.length} {naps.length === 1 ? 'nap' : 'naps'}
          </span>
        </div>
        {naps.length ? (
          <div className="nap-list">
            {naps.map((nap) => {
              const asleep = sleepDuration(nap)
              const stage =
                nap.score_state === 'SCORED'
                  ? nap.score?.stage_summary
                  : undefined
              return (
                <details key={String(nap.id)} className="nap-row">
                  <summary>
                    <Moon size={17} aria-hidden />
                    <span>
                      <strong>
                        {nap.start
                          ? localTime(nap.start, nap.timezone_offset)
                          : 'Time unavailable'}
                        {nap.end
                          ? ` – ${localTime(nap.end, nap.timezone_offset)}`
                          : ''}
                      </strong>
                      <small>
                        {asleep === null
                          ? nap.score_state === 'UNSCORABLE'
                            ? 'Unscorable'
                            : nap.score_state === 'SCORED'
                              ? 'Sleep duration not returned'
                              : 'Not scored yet'
                          : `${duration(asleep)} asleep`}
                      </small>
                    </span>
                    <ChevronDown size={16} aria-hidden />
                  </summary>
                  <dl className="detail-stats">
                    {[
                      ['Light', stage?.total_light_sleep_time_milli],
                      ['Deep', stage?.total_slow_wave_sleep_time_milli],
                      ['REM', stage?.total_rem_sleep_time_milli],
                      ['Awake', stage?.total_awake_time_milli],
                    ].map(([label, milliseconds]) => (
                      <div key={label}>
                        <dt>{label}</dt>
                        <dd>
                          {duration(
                            typeof milliseconds === 'number'
                              ? milliseconds / 3_600_000
                              : null,
                          )}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </details>
              )
            })}
          </div>
        ) : (
          <p className="empty">No naps recorded for this day.</p>
        )}
        <div className="panel-foot">
          <span>
            Naps are grouped by their local end date. Sleep-need credit is
            reported separately by WHOOP.
          </span>
        </div>
      </section>
    </>
  )
}
