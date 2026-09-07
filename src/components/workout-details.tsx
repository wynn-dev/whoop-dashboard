import {
  duration,
  workoutZones,
  type DailyStats,
  type WhoopRecord,
} from '@/lib/whoop'
import { signedValue } from '@/lib/health'

export function DailyHeartRate({ day }: { day: DailyStats | undefined }) {
  return (
    <section className="panel daily-heart-rate">
      <div className="panel-heading">
        <div>
          <h3>Heart rate across your day</h3>
          <p>
            WHOOP physiological-cycle summary · includes time outside workouts
          </p>
        </div>
      </div>
      <dl className="detail-stats">
        <div>
          <dt>Daily average</dt>
          <dd>
            {day?.averageHeartRate == null
              ? '—'
              : Math.round(day.averageHeartRate)}
            <small> bpm</small>
          </dd>
        </div>
        <div>
          <dt>Daily maximum</dt>
          <dd>
            {day?.maxHeartRate == null ? '—' : Math.round(day.maxHeartRate)}
            <small> bpm</small>
          </dd>
        </div>
      </dl>
      <div className="panel-foot">
        <span>Summary readings, not continuous heart-rate data</span>
      </div>
    </section>
  )
}

export function WorkoutDetails({ workout }: { workout: WhoopRecord }) {
  const score = workout.score_state === 'SCORED' ? workout.score : null
  const { total, zones, complete } = workoutZones(workout)
  const anyZones = zones.some((zone) => zone.milliseconds !== null)
  const elapsed =
    workout.start && workout.end
      ? new Date(workout.end).getTime() - new Date(workout.start).getTime()
      : null
  return (
    <div className="workout-insights">
      <div className="workout-insights-head">
        <h4>Heart-rate zones</h4>
        <span>
          {anyZones
            ? `${duration(total / 3_600_000)} recorded`
            : 'Not available'}
        </span>
      </div>
      {anyZones ? (
        <>
          <ol className="zone-list" aria-label="Time in WHOOP heart-rate zones">
            {zones.map((zone) => {
              const percentage =
                zone.milliseconds !== null && total > 0
                  ? (zone.milliseconds / total) * 100
                  : null
              return (
                <li key={zone.index}>
                  <span className="zone-name">
                    <strong>Zone {zone.index}</strong>
                    <small>{zone.label}</small>
                  </span>
                  <span className="zone-track" aria-hidden="true">
                    <span
                      style={{
                        width: `${percentage ?? 0}%`,
                        background: `color-mix(in srgb, var(--c-strain) ${30 + zone.index * 14}%, var(--surface-3))`,
                      }}
                    />
                  </span>
                  <span className="zone-duration">
                    {duration(
                      zone.milliseconds === null
                        ? null
                        : zone.milliseconds / 3_600_000,
                    )}
                  </span>
                  <span className="zone-percentage">
                    {percentage === null ? '—' : `${Math.round(percentage)}%`}
                  </span>
                </li>
              )
            })}
          </ol>
          <p className="detail-copy">
            Percentages use recorded zone time
            {!complete ? '; some zones were not returned' : ''}. Zone totals may
            differ from session duration.
          </p>
        </>
      ) : (
        <p className="detail-copy">
          {workout.score_state === 'SCORED'
            ? 'WHOOP did not return heart-rate zone durations for this activity.'
            : 'Zone details will appear if WHOOP can score this activity.'}
        </p>
      )}
      <dl className="detail-stats workout-extra">
        <div>
          <dt>Session duration</dt>
          <dd>
            {duration(
              elapsed !== null && elapsed >= 0 ? elapsed / 3_600_000 : null,
            )}
          </dd>
        </div>
        <div>
          <dt>Heart-rate data recorded</dt>
          <dd>
            {score?.percent_recorded == null
              ? '—'
              : `${score.percent_recorded.toFixed(1)}%`}
          </dd>
        </div>
        <div>
          <dt>Elevation gained</dt>
          <dd>
            {score?.altitude_gain_meter == null
              ? '—'
              : `${Math.round(score.altitude_gain_meter)} m`}
          </dd>
        </div>
        <div>
          <dt>Net elevation change</dt>
          <dd>
            {score?.altitude_change_meter == null
              ? '—'
              : `${signedValue(score.altitude_change_meter, 0)} m`}
          </dd>
        </div>
      </dl>
      <p className="detail-copy">
        Elevation appears only when included in WHOOP’s activity record. A dash
        means unavailable, not zero.
      </p>
    </div>
  )
}
