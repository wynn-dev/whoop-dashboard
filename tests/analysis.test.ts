import { describe, expect, it } from 'vitest'
import {
  correlationStrength,
  fisherInterval,
  mad,
  median,
  ranks,
  robustZ,
  spearman,
} from '../src/lib/stats'
import {
  bounceBack,
  coverage,
  eveningSessions,
  hardDaySequences,
  hrvReadiness,
  monotony,
  monotonyLabel,
  morningAfterBySport,
  napEffect,
  relationships,
  socialJetlag,
  unusualNights,
  zoneTotals,
} from '../src/lib/analysis'
import type { DailyStats, StoredRecord, WhoopRecord } from '../src/lib/whoop'

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

describe('statistics', () => {
  it('computes median, MAD, and robust z without guessing on flat data', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 3, 2])).toBe(2.5)
    expect(mad([1, 2, 3, 4, 100])).toBeCloseTo(1.4826)
    expect(robustZ(10, [1, 2, 3, 4, 100])).toBeCloseTo(7 / 1.4826, 3)
    expect(robustZ(5, [2, 2, 2, 2])).toBeNull()
  })
  it('ranks ties by their average position and correlates monotonic data', () => {
    expect(ranks([10, 20, 20, 30])).toEqual([1, 2.5, 2.5, 4])
    expect(spearman([1, 2, 3, 4, 5], [2, 4, 6, 8, 10])!.rho).toBe(1)
    expect(spearman([1, 2, 3, 4, 5], [5, 4, 3, 2, 1])!.rho).toBe(-1)
    expect(spearman([1, 2, 3], [1, 1, 1])).toBeNull()
    expect(spearman([1, 2], [2, 1])).toBeNull()
    // Textbook Spearman example with ties.
    const rho = spearman(
      [106, 100, 86, 101, 99, 103, 97, 113, 112, 110],
      [7, 27, 2, 50, 28, 29, 20, 12, 6, 17],
    )!.rho
    expect(rho).toBeCloseTo(-0.1758, 3)
  })
  it('gives a wide interval for small samples and labels strength', () => {
    const [low, high] = fisherInterval(0.5, 30)!
    expect(low).toBeCloseTo(0.167, 2)
    expect(high).toBeCloseTo(0.729, 2)
    expect(fisherInterval(0.5, 3)).toBeNull()
    expect(correlationStrength(0.1)).toBe('negligible')
    expect(correlationStrength(-0.45)).toBe('moderate')
    expect(correlationStrength(0.8)).toBe('strong')
  })
})

describe('relationships', () => {
  it('needs 20 paired days and reports a clear direction only when the interval excludes zero', () => {
    const few = dates(10).map((date, i) =>
      day(date, { sleepHours: 6 + i / 10, recovery: 40 + i * 3 }),
    )
    expect(relationships(few, few)).toEqual([])
    const many = dates(30).map((date, i) =>
      day(date, {
        sleepHours: 6 + (i % 7) / 4,
        recovery: 40 + (i % 7) * 6 + (i % 3),
        hrv: 50 + ((i * 7) % 11),
      }),
    )
    const results = relationships(many, many)
    const sleep = results.find((r) => r.key === 'sleep-recovery')!
    expect(sleep.n).toBe(30)
    expect(sleep.rho).toBeGreaterThan(0.6)
    expect(sleep.clear).toBe(true)
    expect(sleep.reading).toBe('More sleep went with higher recovery.')
    const hrv = results.find((r) => r.key === 'sleep-hrv')!
    expect(hrv.clear).toBe(false)
    expect(hrv.reading).toMatch(/No clear link/)
  })
})

describe('unusual nights', () => {
  it('flags a night only when two or more signals move the concerning way', () => {
    const all = dates(40).map((date, i) =>
      day(date, {
        rhr: 50 + (i % 3),
        hrv: 60 - (i % 4),
        respiratoryRate: 14 + (i % 2) * 0.2,
        skinTemp: 33.4 + (i % 3) * 0.1,
      }),
    )
    // One night: resting HR up, HRV down. Another: only resting HR up.
    all[35] = day(all[35].date, {
      rhr: 62,
      hrv: 45,
      respiratoryRate: 14,
      skinTemp: 33.4,
    })
    all[37] = day(all[37].date, {
      rhr: 62,
      hrv: 60,
      respiratoryRate: 14,
      skinTemp: 33.4,
    })
    const result = unusualNights(all, all.slice(20))
    expect(result.nights.map((night) => night.date)).toEqual([all[35].date])
    expect(result.nights[0].signals.map((s) => s.key).sort()).toEqual([
      'hrv',
      'rhr',
    ])
    expect(result.evaluated).toBe(20)
    // With only 5 prior days nothing can be evaluated.
    expect(unusualNights(all.slice(0, 6), all.slice(5, 6)).building).toBe(1)
  })
})

describe('HRV readiness', () => {
  it('builds a geometric 7-day mean and a 28-day band once 20 baseline days exist', () => {
    const all = dates(40).map((date, i) =>
      day(date, { hrv: i >= 33 ? 40 : 60 + (i % 5) * 2 }),
    )
    const result = hrvReadiness(all, '2026-09-07', 10)
    expect(result.ready).toBe(true)
    expect(result.status).toBe('below')
    expect(result.latest.value).toBeCloseTo(40, 5)
    expect(result.latest.low!).toBeLessThan(result.latest.median!)
    expect(result.latest.high!).toBeGreaterThan(result.latest.median!)
    expect(result.series).toHaveLength(10)
    expect(hrvReadiness(all.slice(0, 10), all[9].date, 5).ready).toBe(false)
  })
})

describe('load and timing', () => {
  it('computes Foster monotony and labels it', () => {
    const even = dates(14).map((date) => day(date, { strain: 10 }))
    expect(monotony(even, '2026-09-07').current.monotony).toBeNull() // sd 0
    const varied = dates(14).map((date, i) =>
      day(date, { strain: [6, 14, 8, 12, 10, 16, 4][i % 7] }),
    )
    const week = monotony(varied, '2026-09-07').current
    expect(week.days).toBe(7)
    expect(week.load).toBe(70)
    expect(week.monotony).toBeCloseTo(10 / 4.3205, 3)
    expect(monotonyLabel(week.monotony)).toBe('Monotonous')
    expect(monotonyLabel(1.2)).toBe('Varied')
  })
  it('sums heart-rate zones and needs enough weekend nights for social jetlag', () => {
    const workout = (zones: number[]): WhoopRecord => ({
      score_state: 'SCORED',
      score: {
        zone_durations: Object.fromEntries(
          ['zero', 'one', 'two', 'three', 'four', 'five'].map((name, i) => [
            `zone_${name}_milli`,
            zones[i] * 60_000,
          ]),
        ),
      },
    })
    const totals = zoneTotals([
      workout([0, 10, 20, 20, 10, 0]),
      workout([0, 30, 30, 0, 0, 0]),
    ])
    expect(totals.sessions).toBe(2)
    expect(totals.totalHours).toBeCloseTo(2)
    expect(totals.easy).toBeCloseTo(0.75)
    expect(totals.moderate).toBeCloseTo(1 / 6)
    expect(totals.hard).toBeCloseTo(1 / 12)

    const nights = dates(21).map((date) => {
      const weekend = [0, 6].includes(new Date(`${date}T12:00:00Z`).getUTCDay())
      return day(date, {
        sleepStart: `${date}T${weekend ? '00' : '22'}:00:00Z`.replace(
          `${date}T22`,
          `${date}T22`,
        ),
        sleepEnd: `${date}T${weekend ? '08' : '06'}:00:00Z`,
      })
    })
    // Weekend sleeps start two hours later and end two hours later.
    for (const night of nights) {
      const weekend = [0, 6].includes(
        new Date(`${night.date}T12:00:00Z`).getUTCDay(),
      )
      const previous = new Date(`${night.date}T12:00:00Z`)
      previous.setUTCDate(previous.getUTCDate() - 1)
      night.sleepStart = `${previous.toISOString().slice(0, 10)}T${weekend ? '23' : '21'}:00:00Z`
    }
    const jetlag = socialJetlag(nights)
    expect(jetlag.ready).toBe(true)
    expect(jetlag.weekendNights).toBe(6)
    expect(jetlag.shift).toBeCloseTo(120)
    expect(socialJetlag(nights.slice(0, 8)).ready).toBe(false)
  })
})

describe('recovery dynamics and groups', () => {
  it('measures days from a low recovery to the next high one and gates on episodes', () => {
    const days = dates(12).map((date, i) =>
      day(date, {
        recovery: [20, 50, 70, 30, 40, 80, 25, 90, 20, 50, 60, 60][i],
      }),
    )
    const result = bounceBack(days)
    expect(result.episodes.map((e) => e.days)).toEqual([2, 2, 1])
    expect(result.censored).toBe(1)
    expect(result.median).toBe(2)
    expect(result.ready).toBe(true)
  })
  it('separates recovery after hard-day runs from single hard days', () => {
    const strains = [15, 15, 8, 15, 8, 15, 15, 15, 8, 15, 8, 15, 15, 8, 15, 8]
    const days = dates(strains.length).map((date, i) =>
      day(date, {
        strain: strains[i],
        recovery: strains[i] === 8 ? (i > 8 ? 60 : 40) : 50,
      }),
    )
    const result = hardDaySequences(days, days)
    expect(result.afterRuns.count).toBe(3)
    expect(result.afterSingles.count).toBe(3)
    expect(result.ready).toBe(false)
  })
  it('compares nap and evening-session days with the next morning', () => {
    const days = dates(14).map((date, i) =>
      day(date, { recovery: 50 + i, sleepHours: 7 }),
    )
    const records: StoredRecord[] = days.slice(0, 6).map((d) => ({
      kind: 'sleep',
      data: {
        id: `nap-${d.date}`,
        nap: true,
        start: `${d.date}T12:00:00Z`,
        end: `${d.date}T12:30:00Z`,
        timezone_offset: '+02:00',
      },
    }))
    const naps = napEffect(days, days, records)
    expect(naps.yesCount).toBe(6)
    expect(naps.noCount).toBe(7)
    expect(naps.ready).toBe(true)
    expect(naps.outcomes[0].yes).toBeCloseTo(53.5)

    const workouts: WhoopRecord[] = days.map((d, i) => ({
      id: `w-${i}`,
      start: `${d.date}T${i % 2 ? '17' : '08'}:00:00Z`,
      end: `${d.date}T${i % 2 ? '18' : '09'}:00:00Z`,
      timezone_offset: '+02:00',
      sport_name: i % 2 ? 'running' : 'cycling',
      score_state: 'SCORED',
      score: { strain: 10 },
    }))
    const evenings = eveningSessions(days, days, workouts)
    expect(evenings.yesCount).toBe(6)
    expect(evenings.noCount).toBe(7)
    const sports = morningAfterBySport(days, workouts)
    expect(sports.ready).toBe(true)
    expect(sports.rows.map((r) => r.sport).sort()).toEqual([
      'cycling',
      'running',
    ])
  })
  it('reports coverage of the period', () => {
    const days = dates(5).map((date, i) =>
      day(date, {
        recovery: i === 2 ? null : 60,
        recoveryState: i === 2 ? 'PENDING_SCORE' : 'SCORED',
      }),
    )
    const result = coverage(days.slice(1), [], '2026-09-07', 7)
    expect(result.days).toBe(4)
    expect(result.missing).toBe(3)
    expect(result.recoveryScored).toBe(3)
    expect(result.recoveryPending).toBe(1)
  })
})
