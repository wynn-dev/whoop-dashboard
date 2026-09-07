import type { DashboardData, StoredRecord } from './whoop'

// Explicit preview data only. Never persisted, mixed with WHOOP data, or used
// as a fallback for failed requests.
export function demoDashboard(): DashboardData {
  const records: StoredRecord[] = []
  const now = new Date()
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  for (let i = 89; i >= 0; i--) {
    const day = today - i * 86_400_000
    const cycleId = 1000 + i
    const sleepId = `demo-sleep-${i}`
    const recovery =
      i === 0
        ? 86
        : Math.round(60 + 26 * Math.sin(i * 0.82) + 8 * Math.cos(i * 0.31))
    const strain =
      i === 0 ? 12.4 : Math.round((10 + 5 * Math.sin(i * 1.2)) * 10) / 10
    const sleepHours = i === 0 ? 7.7 : 7.2 + 1.1 * Math.sin(i * 0.6)
    // Wake time drifts a little from night to night so timing charts have
    // something to show; 05:00 UTC is 07:00 in the demo timezone.
    const weekend = [0, 6].includes(new Date(day).getUTCDay())
    const wakeHour =
      i === 0 ? 5 : 5 + 0.35 * Math.sin(i * 1.9) + (weekend ? 0.9 : 0)
    // One night where several signals move together, to show the
    // unusual-nights view. Recovery is 'scored' but not tied to it.
    const offNight = i === 9
    const start = new Date(day + wakeHour * 3_600_000).toISOString()
    records.push({
      kind: 'cycle',
      data: {
        id: cycleId,
        start,
        timezone_offset: '+02:00',
        score_state: 'SCORED',
        score: {
          strain,
          kilojoule: (2040 + strain * 30) * 4.184,
          average_heart_rate: 67 + Math.round(4 * Math.sin(i * 0.7)),
          max_heart_rate: 171 + Math.round(8 * Math.sin(i * 0.3)),
        },
      },
    })
    records.push({
      kind: 'recovery',
      data: {
        cycle_id: cycleId,
        sleep_id: sleepId,
        score_state: i === 5 ? 'PENDING_SCORE' : 'SCORED',
        score: {
          user_calibrating: i >= 86,
          recovery_score: recovery,
          hrv_rmssd_milli:
            i === 0 ? 72 : 58 + 16 * Math.sin(i * 0.5) - (offNight ? 22 : 0),
          resting_heart_rate:
            i === 0
              ? 52
              : Math.round(55 + 5 * Math.cos(i * 0.3)) + (offNight ? 9 : 0),
          spo2_percentage:
            i === 12 ? undefined : 97.4 + 0.5 * Math.sin(i * 0.6),
          skin_temp_celsius:
            i === 0
              ? 33.8
              : 33.5 + 0.2 * Math.sin(i * 0.4) + (offNight ? 0.7 : 0),
        },
      },
    })
    records.push({
      kind: 'sleep',
      data: {
        id: sleepId,
        cycle_id: cycleId,
        start: new Date(
          day + (wakeHour - sleepHours - 0.4) * 3_600_000,
        ).toISOString(),
        end: start,
        nap: false,
        timezone_offset: '+02:00',
        score_state: 'SCORED',
        score: {
          sleep_performance_percentage:
            i === 0 ? 94 : Math.min(100, Math.round((sleepHours / 8.2) * 100)),
          sleep_efficiency_percentage: 95,
          sleep_consistency_percentage: 87,
          respiratory_rate:
            14.2 + 0.3 * Math.sin(i * 0.8) + (offNight ? 1.6 : 0),
          stage_summary: {
            total_in_bed_time_milli: (sleepHours + 0.4) * 3_600_000,
            total_no_data_time_milli: 0,
            disturbance_count: 4 + (i % 6),
            sleep_cycle_count: 4 + (i % 2),
            total_light_sleep_time_milli: sleepHours * 0.51 * 3_600_000,
            total_slow_wave_sleep_time_milli: sleepHours * 0.22 * 3_600_000,
            total_rem_sleep_time_milli: sleepHours * 0.27 * 3_600_000,
            total_awake_time_milli: 0.4 * 3_600_000,
          },
          sleep_needed: {
            baseline_milli: 7.5 * 3_600_000,
            need_from_sleep_debt_milli: 0.5 * 3_600_000,
            need_from_recent_strain_milli: 0.4 * 3_600_000,
            need_from_recent_nap_milli: -0.2 * 3_600_000,
          },
        },
      },
    })
    if (i % 4 === 0)
      records.push({
        kind: 'sleep',
        data: {
          id: `demo-nap-${i}`,
          cycle_id: cycleId,
          nap: true,
          start: new Date(day + 12 * 3_600_000).toISOString(),
          end: new Date(day + 12.5 * 3_600_000).toISOString(),
          timezone_offset: '+02:00',
          score_state: 'SCORED',
          score: {
            stage_summary: {
              total_light_sleep_time_milli: 20 * 60_000,
              total_slow_wave_sleep_time_milli: 5 * 60_000,
              total_rem_sleep_time_milli: 0,
              total_awake_time_milli: 5 * 60_000,
            },
          },
        },
      })
    if (i % 3 !== 2)
      records.push({
        kind: 'workout',
        data: {
          id: `demo-workout-${i}`,
          // Most sessions late morning; every fifth one in the evening.
          start: new Date(
            day + (i % 5 === 1 ? 17.5 : 9) * 3_600_000,
          ).toISOString(),
          end: new Date(
            day +
              ((i % 5 === 1 ? 17.5 : 9) + [0.75, 1, 1.5][i % 3]) * 3_600_000,
          ).toISOString(),
          sport_name: ['running', 'weightlifting', 'cycling'][(i % 4) % 3],
          timezone_offset: '+02:00',
          score_state: 'SCORED',
          score: {
            strain: strain * 0.8,
            average_heart_rate: 136,
            max_heart_rate: 171,
            kilojoule: 380 * 4.184,
            distance_meter: i % 3 === 0 ? 6200 : undefined,
            altitude_gain_meter: i % 3 === 0 ? 48 : undefined,
            altitude_change_meter: i % 3 === 0 ? -7 : undefined,
            percent_recorded: 99.6,
            zone_durations: {
              zone_zero_milli: 0,
              zone_one_milli: 600_000,
              zone_two_milli: 1_200_000,
              zone_three_milli: 600_000,
              zone_four_milli: 300_000,
              zone_five_milli: 0,
            },
          },
        },
      })
  }
  return {
    user: {
      firstName: 'Alex',
      lastName: 'Morgan',
      email: 'preview@example.com',
    },
    syncedAt: new Date().toISOString(),
    syncing: false,
    syncError: null,
    needsReconnect: false,
    records,
  }
}
