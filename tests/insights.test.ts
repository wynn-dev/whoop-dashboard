import { describe, expect, it } from 'vitest'
import {
  clockFromNight,
  enoughVariety,
  loadLabel,
  recoveryByPriorStrain,
  recoveryBySleepNeed,
  recoveryMix,
  sleepBalance,
  sleepTiming,
  sportBreakdown,
  standardDeviation,
  streak,
  byWeekday,
  trainingLoad,
  weekInReview,
  workoutsThrough,
} from '../src/lib/insights'
import {
  localMinutes,
  type DailyStats,
  type WhoopRecord,
} from '../src/lib/whoop'

function day(date: string, overrides: Partial<DailyStats> = {}): DailyStats {
  return {
    date,
    cycleId: date,
    recovery: null,
    strain: null,
    hrv: null,
    rhr: null,
    sleepHours: null,
    sleepPerformance: null,
    sleepEfficiency: null,
    sleepConsistency: null,
    sleepNeededHours: null,
    remHours: null,
    deepHours: null,
    lightHours: null,
    awakeHours: null,
    spo2: null,
    skinTemp: null,
    respiratoryRate: null,
    calories: null,
    recoveryState: 'SCORED',
    sleepStart: null,
    sleepEnd: null,
    timezoneOffset: '+02:00',
    recoveryCalibrating: false,
    sleepState: 'SCORED',
    sleepBaselineHours: null,
    sleepDebtHours: null,
    sleepStrainHours: null,
    sleepNapCreditHours: null,
    inBedHours: null,
    noDataHours: null,
    disturbanceCount: null,
    sleepCycleCount: null,
    averageHeartRate: null,
    maxHeartRate: null,
    ...overrides,
  }
}
const dates = (count: number, end = '2026-09-07') =>
  Array.from({ length: count }, (_, i) => {
    const d = new Date(`${end}T12:00:00Z`)
    d.setUTCDate(d.getUTCDate() - (count - 1 - i))
    return d.toISOString().slice(0, 10)
  })

describe('week in review', () => {
  it('compares 7 days through the selected day with the 7 before, ignoring gaps', () => {
    const days = dates(14).map((date, i) =>
      day(date, { recovery: i < 7 ? 50 : i === 10 ? null : 70, rhr: 50 + i }),
    )
    const review = weekInReview(days, '2026-09-07')
    expect(review.start).toBe('2026-09-01')
    expect(review.previousEnd).toBe('2026-08-31')
    const recovery = review.metrics.find((m) => m.key === 'recovery')!
    expect(recovery.current).toBe(70)
    expect(recovery.previous).toBe(50)
    expect(recovery.currentCount).toBe(6)
    expect(recovery.previousCount).toBe(7)
    expect(review.metrics.find((m) => m.key === 'rhr')!.better).toBe('down')
  })
})

describe('recovery mix and drivers', () => {
  it('counts zones and leaves unscored days out of the scored total', () => {
    const mix = recoveryMix([
      day('2026-09-01', { recovery: 80 }),
      day('2026-09-02', { recovery: 67 }),
      day('2026-09-03', { recovery: 40 }),
      day('2026-09-04', { recovery: 33 }),
      day('2026-09-05'),
    ])
    expect(mix).toEqual({
      high: 2,
      moderate: 1,
      low: 1,
      unscored: 1,
      scored: 4,
      total: 5,
    })
  })
  it('groups recovery by how much of the sleep need was met', () => {
    const buckets = recoveryBySleepNeed([
      day('2026-09-01', { recovery: 80, sleepHours: 8, sleepNeededHours: 8 }),
      day('2026-09-02', { recovery: 60, sleepHours: 7, sleepNeededHours: 8 }),
      day('2026-09-03', { recovery: 40, sleepHours: 6, sleepNeededHours: 8 }),
      day('2026-09-04', { recovery: 50, sleepHours: 6, sleepNeededHours: 0 }),
      day('2026-09-05', { recovery: null, sleepHours: 8, sleepNeededHours: 8 }),
    ])
    expect(buckets.map((b) => [b.count, b.average])).toEqual([
      [1, 80],
      [1, 60],
      [1, 40],
    ])
    expect(enoughVariety(buckets)).toBe(false)
  })
  it('groups recovery by the previous day’s strain using the full history', () => {
    const all = [
      day('2026-08-31', { strain: 15 }),
      day('2026-09-01', { recovery: 40, strain: 8 }),
      day('2026-09-02', { recovery: 70, strain: 12 }),
      day('2026-09-03', { recovery: 60 }),
    ]
    const buckets = recoveryByPriorStrain(all, all.slice(1))
    expect(buckets.map((b) => [b.label, b.count, b.average])).toEqual([
      ['After a light day', 1, 70],
      ['After a moderate day', 1, 60],
      ['After a hard day', 1, 40],
    ])
  })
})

describe('sleep timing', () => {
  it('keeps bedtimes after midnight after bedtimes before it', () => {
    expect(localMinutes('2026-09-06T21:30:00Z', '+02:00')).toBe(23 * 60 + 30)
    const timing = sleepTiming([
      day('2026-09-06', {
        sleepStart: '2026-09-05T21:00:00Z', // 11:00 PM local
        sleepEnd: '2026-09-06T05:00:00Z', // 7:00 AM local
        sleepHours: 7.5,
      }),
      day('2026-09-07', {
        sleepStart: '2026-09-06T23:00:00Z', // 1:00 AM local
        sleepEnd: '2026-09-07T06:00:00Z', // 8:00 AM local
        sleepHours: 6.5,
      }),
    ])
    expect(timing.nights.map((n) => [n.bed, n.wake])).toEqual([
      [300, 780],
      [420, 840],
    ])
    expect(clockFromNight(timing.bedtime!)).toBe('12:00 AM')
    expect(clockFromNight(timing.wake!)).toBe('7:30 AM')
    expect(timing.bedtimeSpread).toBeCloseTo(84.85, 1)
  })
  it('sums the balance against need over the last nights only', () => {
    const days = dates(9).map((date, i) =>
      day(date, { sleepHours: 7, sleepNeededHours: i === 0 ? 20 : 7.5 }),
    )
    const balance = sleepBalance(days, '2026-09-07')
    expect(balance.count).toBe(7)
    expect(balance.hours).toBeCloseTo(-3.5)
  })
  it('measures spread with a sample standard deviation', () => {
    expect(standardDeviation([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.138, 3)
    expect(standardDeviation([5])).toBeNull()
  })
})

describe('training load', () => {
  const workout = (
    id: string,
    start: string,
    hours: number,
    sport: string,
    strain = 10,
  ): WhoopRecord => ({
    id,
    start,
    end: new Date(new Date(start).getTime() + hours * 3_600_000).toISOString(),
    sport_name: sport,
    timezone_offset: '+02:00',
    score_state: 'SCORED',
    score: { strain, kilojoule: 418.4 },
  })
  it('needs 14 chronic days before it reports a ratio', () => {
    const short = dates(10).map((date) => day(date, { strain: 10 }))
    expect(trainingLoad(short, '2026-09-07').ratio).toBeNull()
    const long = dates(28).map((date, i) =>
      day(date, { strain: i >= 21 ? 14 : 10 }),
    )
    const load = trainingLoad(long, '2026-09-07')
    expect(load.acute).toBe(14)
    expect(load.chronic).toBe(11)
    expect(load.ratio).toBeCloseTo(14 / 11)
    expect(loadLabel(load.ratio)).toBe('Ramping up')
    expect(loadLabel(0.8)).toBe('Backing off')
    expect(loadLabel(1)).toBe('Steady')
  })
  it('breaks volume down by sport, sorted by time', () => {
    const workouts = [
      workout('a', '2026-09-07T07:00:00Z', 1, 'running', 12),
      workout('b', '2026-09-06T07:00:00Z', 0.5, 'running', 8),
      workout('c', '2026-09-05T07:00:00Z', 2, 'cycling'),
      workout('d', '2026-08-20T07:00:00Z', 3, 'weight_lifting'),
    ]
    expect(workoutsThrough(workouts, '2026-09-07', 7).map((w) => w.id)).toEqual(
      ['a', 'b', 'c'],
    )
    const sports = sportBreakdown(workoutsThrough(workouts, '2026-09-07', 7))
    expect(sports.map((s) => [s.sport, s.sessions, s.hours, s.strain])).toEqual(
      [
        ['cycling', 1, 2, 10],
        ['running', 2, 1.5, 10],
      ],
    )
    expect(sports[0].calories).toBeCloseTo(100)
    expect(sportBreakdown(workouts).at(-1)?.sport).toBe('running')
    expect(sportBreakdown(workouts)[0].sport).toBe('weight lifting')
  })
})

describe('weekday pattern and streaks', () => {
  it('averages by weekday starting on Monday', () => {
    const pattern = byWeekday(
      [
        day('2026-09-07', { recovery: 80 }), // Monday
        day('2026-08-31', { recovery: 60 }), // Monday
        day('2026-09-06', { recovery: 30 }), // Sunday
        day('2026-09-05'), // Saturday, unscored
      ],
      'recovery',
    )
    expect(pattern.map((p) => [p.label, p.count, p.average])).toEqual([
      ['Mon', 2, 70],
      ['Tue', 0, null],
      ['Wed', 0, null],
      ['Thu', 0, null],
      ['Fri', 0, null],
      ['Sat', 0, null],
      ['Sun', 1, 30],
    ])
  })
  it('counts current and longest runs of consecutive days', () => {
    const high = (d: DailyStats) => (d.recovery ?? 0) >= 67
    const days = [
      day('2026-09-01', { recovery: 70 }),
      day('2026-09-02', { recovery: 70 }),
      day('2026-09-03', { recovery: 70 }),
      day('2026-09-04', { recovery: 20 }),
      day('2026-09-06', { recovery: 70 }),
      day('2026-09-07', { recovery: 70 }),
    ]
    expect(streak(days, '2026-09-07', high)).toEqual({ current: 2, longest: 3 })
    expect(streak(days, '2026-09-04', high).current).toBe(0)
    // A gap on Sep 5 breaks a run even though Sep 6 and 7 qualify.
    expect(streak(days, '2026-09-06', high).current).toBe(1)
  })
})
