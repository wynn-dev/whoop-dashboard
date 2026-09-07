import { describe, expect, it } from 'vitest'
import {
  buildDailyStats,
  daysThrough,
  shiftDate,
  napsOnDate,
  sleepDuration,
  workoutZones,
  type DailyStats,
  type StoredRecord,
} from '../src/lib/whoop'
import {
  personalBaseline,
  readingStatus,
  healthSeries,
  signedValue,
  quantile,
} from '../src/lib/health'

function day(date: string, overrides: Partial<DailyStats> = {}): DailyStats {
  return {
    ...buildDailyStats([
      { kind: 'cycle', data: { id: date, start: `${date}T12:00:00Z` } },
    ])[0],
    ...overrides,
  }
}
const history = () =>
  Array.from({ length: 40 }, (_, i) =>
    day(shiftDate('2026-01-01', i), {
      hrv: i,
      respiratoryRate: 14,
      recoveryCalibrating: false,
    }),
  )

describe('FORM personal comparisons', () => {
  it('uses only the preceding 30 calendar days, never the selected day or future days', () => {
    const baseline = personalBaseline(history(), '2026-01-31', 'hrv')
    expect(baseline.count).toBe(30)
    expect(baseline.median).toBe(14.5)
    expect(baseline.low).toBeCloseTo(2.9)
    expect(baseline.high).toBeCloseTo(26.1)
    expect(
      personalBaseline(
        history().map((d) =>
          d.date >= '2026-01-31' ? { ...d, hrv: 9999 } : d,
        ),
        '2026-01-31',
        'hrv',
      ),
    ).toEqual(baseline)
  })
  it('requires 14 distinct valid days, excluding missing and non-finite values', () => {
    const days = history().slice(0, 13)
    days.push({ ...days[0], cycleId: 'another-cycle' })
    days.push(day('2026-01-14', { hrv: Number.NaN }))
    days.push(day('2026-01-15', { hrv: null }))
    const insufficient = personalBaseline(days, '2026-01-31', 'hrv')
    expect(insufficient).toMatchObject({
      count: 13,
      ready: false,
      median: null,
      low: null,
      high: null,
    })
    days.push(day('2026-01-16', { hrv: 0 }))
    expect(personalBaseline(days, '2026-01-31', 'hrv').ready).toBe(true)
  })
  it('excludes calibrating recovery readings but not independent sleep respiration', () => {
    const days = history().map((d) => ({ ...d, recoveryCalibrating: true }))
    expect(personalBaseline(days, '2026-01-31', 'hrv').count).toBe(0)
    expect(personalBaseline(days, '2026-01-31', 'respiratoryRate').count).toBe(
      30,
    )
  })
  it('has explicit missing, calibration, insufficient-history and deviation states', () => {
    const baseline = personalBaseline(history(), '2026-01-31', 'hrv')
    expect(readingStatus(undefined, 'hrv', baseline)).toBe('missing')
    expect(
      readingStatus(
        day('2026-01-31', { hrv: 50, recoveryCalibrating: true }),
        'hrv',
        baseline,
      ),
    ).toBe('calibrating')
    expect(
      readingStatus(
        day('2026-01-31', { hrv: 50 }),
        'hrv',
        personalBaseline([], '2026-01-31', 'hrv'),
      ),
    ).toBe('building')
    expect(readingStatus(day('2026-01-31', { hrv: 50 }), 'hrv', baseline)).toBe(
      'above',
    )
    expect(readingStatus(day('2026-01-31', { hrv: 0 }), 'hrv', baseline)).toBe(
      'below',
    )
    expect(
      readingStatus(day('2026-01-31', { hrv: baseline.low }), 'hrv', baseline),
    ).toBe('within')
  })
  it('preserves gaps and computes the same baseline independently of visible chart period', () => {
    const days = history().filter((d) => d.date !== '2026-01-29')
    const short = healthSeries(days, '2026-01-31', 'hrv', 7)
    const long = healthSeries(days, '2026-01-31', 'hrv', 30)
    expect(short).toHaveLength(7)
    expect(short.find((p) => p.day === '2026-01-29')?.value).toBeNull()
    expect(short.at(-1)).toEqual(long.at(-1))
    expect(short.at(-1)?.value).toBe(30)
  })
  it('handles a constant observed range and avoids negative zero formatting', () => {
    const days = history().map((d) => ({ ...d, skinTemp: 33.5 }))
    const baseline = personalBaseline(days, '2026-01-31', 'skinTemp')
    expect(baseline).toMatchObject({ low: 33.5, high: 33.5, median: 33.5 })
    expect(signedValue(-0.001)).toBe('0.0')
    expect(signedValue(-0.2)).toBe('−0.2')
    expect(quantile([], 0.5)).toBeNull()
  })
})

describe('sleep and workout detail integrity', () => {
  it('anchors historical ranges to the selected day, including month and leap-day boundaries', () => {
    expect(shiftDate('2024-03-01', -1)).toBe('2024-02-29')
    expect(daysThrough(history(), '2026-01-10', 7).map((d) => d.date)).toEqual(
      Array.from({ length: 7 }, (_, i) => shiftDate('2026-01-04', i)),
    )
  })
  it('keeps nap credit signed, real zeros present, and omitted detail fields absent', () => {
    const [stats] = buildDailyStats([
      {
        kind: 'cycle',
        data: {
          id: 1,
          start: '2026-01-01T12:00:00Z',
          score_state: 'SCORED',
          score: { average_heart_rate: 68, max_heart_rate: 170 },
        },
      },
      {
        kind: 'sleep',
        data: {
          id: 'main',
          cycle_id: 1,
          nap: false,
          score_state: 'SCORED',
          score: {
            sleep_needed: {
              baseline_milli: 8 * 3_600_000,
              need_from_sleep_debt_milli: 0,
              need_from_recent_nap_milli: -1_800_000,
            },
            stage_summary: {
              disturbance_count: 0,
              sleep_cycle_count: 4,
              total_no_data_time_milli: 0,
            },
          },
        },
      },
    ])
    expect(stats).toMatchObject({
      sleepNapCreditHours: -0.5,
      sleepDebtHours: 0,
      sleepNeededHours: 7.5,
      sleepStrainHours: null,
      disturbanceCount: 0,
      sleepCycleCount: 4,
      noDataHours: 0,
      inBedHours: null,
      averageHeartRate: 68,
      maxHeartRate: 170,
    })
  })
  it('groups naps by local end date and computes sleep time without awake time', () => {
    const records: StoredRecord[] = [
      {
        kind: 'sleep',
        data: {
          id: 'nap',
          nap: true,
          start: '2026-01-01T21:50:00Z',
          end: '2026-01-01T22:20:00Z',
          timezone_offset: '+02:00',
          score_state: 'SCORED',
          score: {
            stage_summary: {
              total_light_sleep_time_milli: 1_200_000,
              total_rem_sleep_time_milli: 0,
              total_slow_wave_sleep_time_milli: 300_000,
              total_awake_time_milli: 300_000,
            },
          },
        },
      },
    ]
    expect(napsOnDate(records, '2026-01-01')).toHaveLength(0)
    expect(napsOnDate(records, '2026-01-02')).toHaveLength(1)
    expect(sleepDuration(records[0].data)).toBeCloseTo(25 / 60)
    expect(
      sleepDuration({ ...records[0].data, score_state: 'PENDING_SCORE' }),
    ).toBeNull()
  })
  it('never joins a linked nap as the main nightly sleep', () => {
    const [stats] = buildDailyStats([
      { kind: 'cycle', data: { id: 1, start: '2026-01-01T12:00:00Z' } },
      { kind: 'recovery', data: { cycle_id: 1, sleep_id: 'nap' } },
      {
        kind: 'sleep',
        data: {
          id: 'nap',
          cycle_id: 1,
          nap: true,
          end: '2026-01-02T12:00:00Z',
        },
      },
      {
        kind: 'sleep',
        data: {
          id: 'night',
          cycle_id: 1,
          nap: false,
          end: '2026-01-01T08:00:00Z',
        },
      },
    ])
    expect(stats.sleepEnd).toBe('2026-01-01T08:00:00Z')
  })
  it('does not turn missing, negative, or unscored zone durations into measured zero', () => {
    const scored = {
      score_state: 'SCORED' as const,
      score: {
        zone_durations: {
          zone_zero_milli: 0,
          zone_two_milli: 900_000,
          zone_five_milli: -1,
        },
      },
    }
    const result = workoutZones(scored)
    expect(result.total).toBe(900_000)
    expect(result.complete).toBe(false)
    expect(result.zones[0].milliseconds).toBe(0)
    expect(result.zones[1].milliseconds).toBeNull()
    expect(result.zones[5].milliseconds).toBeNull()
    expect(
      workoutZones({ ...scored, score_state: 'PENDING_SCORE' }).total,
    ).toBe(0)
  })
})
