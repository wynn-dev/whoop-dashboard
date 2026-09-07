import { describe, expect, it } from 'vitest'
import {
  buildDailyStats,
  duration,
  localDate,
  localTime,
  mean,
  type StoredRecord,
} from '../src/lib/whoop'

describe('WHOOP physiological dates and metrics', () => {
  it('uses the recorded timezone instead of UTC or the browser timezone', () => {
    expect(localDate('2026-09-06T23:30:00Z', '+02:00')).toBe('2026-09-07')
    expect(localDate('2026-09-07T02:00:00Z', '-05:00')).toBe('2026-09-06')
  })
  it('joins by cycle and sleep IDs, excludes naps, and does not turn missing scores into zero', () => {
    const records: StoredRecord[] = [
      {
        kind: 'cycle',
        data: {
          id: 1,
          start: '2026-09-07T03:00:00Z',
          score_state: 'SCORED',
          score: { strain: 0, kilojoule: 4184 },
        },
      },
      {
        kind: 'cycle',
        data: {
          id: 2,
          start: '2026-09-08T03:00:00Z',
          score_state: 'PENDING_SCORE',
        },
      },
      {
        kind: 'recovery',
        data: {
          cycle_id: 1,
          sleep_id: 'night',
          score_state: 'SCORED',
          score: { recovery_score: 0, hrv_rmssd_milli: 50 },
        },
      },
      {
        kind: 'sleep',
        data: {
          id: 'nap',
          cycle_id: 1,
          nap: true,
          score_state: 'SCORED',
          score: { stage_summary: { total_light_sleep_time_milli: 900_000 } },
        },
      },
      {
        kind: 'sleep',
        data: {
          id: 'night',
          cycle_id: 1,
          nap: false,
          score_state: 'SCORED',
          score: {
            stage_summary: {
              total_light_sleep_time_milli: 14_400_000,
              total_slow_wave_sleep_time_milli: 7_200_000,
              total_rem_sleep_time_milli: 3_600_000,
              total_awake_time_milli: 1_800_000,
              total_no_data_time_milli: 900_000,
            },
            sleep_needed: {
              baseline_milli: 28_800_000,
              need_from_recent_nap_milli: -1_800_000,
            },
          },
        },
      },
    ]
    const [scored, pending] = buildDailyStats(records)
    expect(scored.sleepHours).toBe(7)
    expect(scored.sleepNeededHours).toBe(7.5)
    expect(scored.recovery).toBe(0)
    expect(scored.strain).toBe(0)
    expect(scored.calories).toBeCloseTo(1000)
    expect(pending.recovery).toBeNull()
    expect(pending.strain).toBeNull()
    expect(pending.sleepHours).toBeNull()
  })
  it('does not include absent data in averages and rounds durations across hour boundaries', () => {
    expect(mean([0, null, 10, undefined, Number.NaN])).toBe(5)
    expect(mean([null])).toBeNull()
    expect(duration(7 + 59.8 / 60)).toBe('8h 00m')
    expect(duration(null)).toBe('—')
  })
  it('formats wall-clock times in the recorded timezone', () => {
    expect(localTime('2026-09-06T21:30:00Z', '+02:00')).toBe('11:30 PM')
    expect(localTime('2026-09-07T11:05:00Z', '-05:00')).toBe('6:05 AM')
  })
  it('labels a cycle by the main sleep wake-up date, not the previous bedtime', () => {
    const [day] = buildDailyStats([
      {
        kind: 'cycle',
        data: {
          id: 42,
          start: '2026-09-06T21:00:00Z',
          timezone_offset: '+02:00',
        },
      },
      {
        kind: 'sleep',
        data: {
          id: 'overnight',
          cycle_id: 42,
          start: '2026-09-06T21:00:00Z',
          end: '2026-09-07T05:00:00Z',
          timezone_offset: '+02:00',
          nap: false,
        },
      },
    ])
    expect(day.date).toBe('2026-09-07')
  })
})
