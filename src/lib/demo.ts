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
    const start = new Date(day + 5 * 3_600_000).toISOString()
    records.push({
      kind: 'cycle',
      data: {
        id: cycleId,
        start,
        timezone_offset: '+02:00',
        score_state: 'SCORED',
        score: { strain, kilojoule: (2040 + strain * 30) * 4.184 },
      },
    })
    records.push({
      kind: 'recovery',
      data: {
        cycle_id: cycleId,
        sleep_id: sleepId,
        score_state: 'SCORED',
        score: {
          recovery_score: recovery,
          hrv_rmssd_milli: i === 0 ? 72 : 58 + 16 * Math.sin(i * 0.5),
          resting_heart_rate:
            i === 0 ? 52 : Math.round(55 + 5 * Math.cos(i * 0.3)),
          spo2_percentage: 97.4,
          skin_temp_celsius: 33.5,
        },
      },
    })
    records.push({
      kind: 'sleep',
      data: {
        id: sleepId,
        cycle_id: cycleId,
        start: new Date(day + (5 - sleepHours - 0.4) * 3_600_000).toISOString(),
        end: start,
        nap: false,
        timezone_offset: '+02:00',
        score_state: 'SCORED',
        score: {
          sleep_performance_percentage:
            i === 0 ? 94 : Math.min(100, Math.round((sleepHours / 8.2) * 100)),
          sleep_efficiency_percentage: 95,
          sleep_consistency_percentage: 87,
          respiratory_rate: 14.2,
          stage_summary: {
            total_light_sleep_time_milli: sleepHours * 0.51 * 3_600_000,
            total_slow_wave_sleep_time_milli: sleepHours * 0.22 * 3_600_000,
            total_rem_sleep_time_milli: sleepHours * 0.27 * 3_600_000,
            total_awake_time_milli: 0.4 * 3_600_000,
          },
          sleep_needed: { baseline_milli: 8.2 * 3_600_000 },
        },
      },
    })
    if (i % 3 !== 2)
      records.push({
        kind: 'workout',
        data: {
          id: `demo-workout-${i}`,
          start: new Date(day + 9 * 3_600_000).toISOString(),
          end: new Date(day + 9.75 * 3_600_000).toISOString(),
          sport_name: ['running', 'weightlifting', 'cycling'][i % 3],
          timezone_offset: '+02:00',
          score_state: 'SCORED',
          score: {
            strain: strain * 0.8,
            average_heart_rate: 136,
            max_heart_rate: 171,
            kilojoule: 380 * 4.184,
            zone_durations: {
              zone_one_milli: 600_000,
              zone_two_milli: 1_200_000,
              zone_three_milli: 600_000,
              zone_four_milli: 300_000,
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
