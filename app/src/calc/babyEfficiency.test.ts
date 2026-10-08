import { describe, expect, it } from 'vitest'
import {
  BABY_POKEMON_IDS, DEFAULT_BABY_EFFICIENCY, EFFICIENCY_SLEEP_TYPES, efficiencyCurve, efficiencyDrawState,
  efficiencyIslands, searchBabyEfficiency, strengthForPower, validateBabyEfficiency,
  type EfficiencyIsland, type EfficiencyStyle,
} from './babyEfficiency'
import { efficiencyRandom, simulateEfficiencyState, type EfficiencyReward } from './babyEfficiencyDraw'
import { drowsyPower, rankFromStrength, sleepExpect, unlockedStyles } from './sleep'
import { familyOf } from './candyPlan'

const zero = { catch: 0, candy: 0 }
const fixture: EfficiencyIsland = {
  id: 'cyan', name: '测试岛',
  bands: [{ count: 3, min: 0 }, { count: 4, min: 8 }, { count: 5, min: 20 }],
  fallbacks: Object.fromEntries(EFFICIENCY_SLEEP_TYPES.map((type) => [type, zero])) as EfficiencyIsland['fallbacks'],
  styles: [
    { sleepType: '淺淺入夢', special: false, catch: 1, candy: 4, unlockStrength: 1, dpr: 0 },
    { sleepType: '淺淺入夢', special: false, catch: 1, candy: 6, unlockStrength: 2, dpr: 12 },
    { sleepType: '深深入眠', special: false, catch: 0, candy: 12, unlockStrength: 3, dpr: 25 },
    ...Array.from({ length: 5 }, () => ({ sleepType: '淺淺入夢' as const, special: false, catch: 0, candy: 0, unlockStrength: 4, dpr: 0 })),
  ],
}

describe('baby efficiency draw distribution', () => {
  it('counts all target faces and family rewards using ordinary weights', () => {
    const totals = simulateEfficiencyState({
      buckets: [{ count: 2, dpr: 0, typed: true, special: false, catch: 1, candy: 4 }, { count: 10, dpr: 0, typed: true, special: false, catch: 0, candy: 0 }],
      power: 100_000, encounters: 3, otherSlots: 0, typedFallback: zero, openFallback: zero,
    }, 20000)
    expect(totals.catch / 20000).toBeCloseTo(0.5, 1)
    expect(totals.candy).toBe(totals.catch * 4)
  })

  it('removes all special styles after one draw and then uses the fallback', () => {
    const result = simulateEfficiencyState({
      buckets: [{ count: 3, dpr: 0, typed: true, special: true, catch: 1, candy: 4 }, { count: 2, dpr: 0, typed: true, special: true, catch: 0, candy: 0 }],
      power: 100_000, encounters: 3, otherSlots: 0, typedFallback: { catch: 0, candy: 10 }, openFallback: zero,
    }, 20000)
    expect(result.catch / 20000).toBeCloseTo(0.6, 1)
    expect(result.candy).toBe(result.catch * 4 + 20 * 20000)
  })

  it('allows repeats in both open and typed pools', () => {
    const result = simulateEfficiencyState({
      buckets: [{ count: 1, dpr: 0, typed: true, special: false, catch: 1, candy: 4 }, { count: 1, dpr: 0, typed: false, special: false, catch: 0, candy: 0 }],
      power: 100_000, encounters: 3, otherSlots: 2, typedFallback: { catch: 0, candy: 10 }, openFallback: zero,
    }, 100)
    expect(result.catch).toBeGreaterThan(100)
    expect(result.candy).toBe(result.catch * 4)
  })

  it.each([false, true])('matches the existing sleep engine statistically (cross type %s)', (eventMix) => {
    const island = efficiencyIslands(1).find((row) => row.id === 'greengrass')!
    const strength = 90000
    const dp = drowsyPower(60, strength)
    const curve = efficiencyCurve(island, 60, 1)
    const state = curve.filter((row) => row.min <= strength).at(-1)!
    const totals = simulateEfficiencyState(efficiencyDrawState(island, state, '淺淺入夢', eventMix, dp), 10000)
    const rows = sleepExpect('greengrass', '淺淺入夢', dp, 10000, 'normal', {
      rank: rankFromStrength('greengrass', strength), undiscoveredBoost: false, eventMix, seed: 1,
    })
    const caught = rows.filter((row) => row.pokeId === 1).reduce((sum, row) => sum + row.count, 0) / 10000
    const candy = rows.filter((row) => familyOf(row.pokeId) === familyOf(1)).reduce((sum, row) => sum + row.candy, 0) / 10000
    expect(Math.abs(totals.catch / 10000 - caught)).toBeLessThan(0.06)
    expect(Math.abs(totals.candy / 10000 - candy)).toBeLessThan(0.3)
  }, 15000)
})

describe('energy intervals and exhaustive sleep allocation', () => {
  it('restricts selection to chain roots and collects branched families', () => {
    expect(BABY_POKEMON_IDS).toContain(172)
    expect(BABY_POKEMON_IDS).not.toContain(25)
    const styles = efficiencyIslands(133).flatMap((island) => island.styles)
    expect(styles.some((style) => style.catch === 0 && style.candy > 0)).toBe(true)
    expect(validateBabyEfficiency({ ...DEFAULT_BABY_EFFICIENCY, iterations: 99 })).toMatch(/次数/)
    expect(validateBabyEfficiency({ ...DEFAULT_BABY_EFFICIENCY, pokeId: 2 })).toMatch(/一阶段/)
  })

  it('places float multiplier boundaries at the first valid integer energy', () => {
    for (const mult of [1, 1.1, 1.3, 1.5, 2.5]) {
      for (const score of [1, 7, 33, 100]) {
        const min = strengthForPower(965232, score, mult)
        expect(drowsyPower(score, min, mult)).toBeGreaterThanOrEqual(965232)
        expect(drowsyPower(score, min - 1, mult)).toBeLessThan(965232)
      }
    }
  })

  it('matches actual unlocked pools immediately before and after every real threshold', () => {
    const island = efficiencyIslands(590).find((row) => row.id === 'lapis')!
    const curve = efficiencyCurve(island, 37, 1.3)
    for (const state of curve) {
      for (const strength of [state.min, Math.max(1, state.min - 1)]) {
        const active = curve.filter((row) => row.min <= strength).at(-1)!
        const actual = unlockedStyles(island.id, '没有特征', drowsyPower(37, strength, 1.3), rankFromStrength(island.id, strength), 'normal')
        expect(active.groups.filter((group) => group.dpr <= drowsyPower(37, strength, 1.3)).reduce((sum, group) => sum + group.count, 0)).toBe(actual.length)
      }
    }
  })

  it('matches a direct integer-energy scan and returns all optimal energy coverage', () => {
    const options = { ...DEFAULT_BABY_EFFICIENCY, precision: 'high' as const, iterations: 100 }
    const result = searchBabyEfficiency(options, () => {}, [fixture])
    const directAt = (strength: number) => {
      const sessions = new Map<number, EfficiencyReward>()
      for (let score = 1; score <= 100; score++) {
        const eligible = fixture.styles.filter((style) => strength >= style.unlockStrength)
        const groups = eligible.map((style: EfficiencyStyle) => ({ ...style, count: 1 }))
        const encounters = fixture.bands.reduce((count, band) => drowsyPower(score, strength) >= band.min ? band.count : count, 3)
        const best = { catch: 0, candy: 0 }
        for (const type of EFFICIENCY_SLEEP_TYPES) {
          const metric = simulateEfficiencyState(efficiencyDrawState(fixture, { min: strength, encounters, groups }, type, false, drowsyPower(score, strength)), 100, efficiencyRandom(1))
          best.catch = Math.max(best.catch, metric.catch)
          best.candy = Math.max(best.candy, metric.candy)
        }
        sessions.set(score, best)
      }
      const best = { ...sessions.get(100)! }
      for (let score = 1; score <= 50; score++) {
        best.catch = Math.max(best.catch, sessions.get(score)!.catch + sessions.get(100 - score)!.catch)
        best.candy = Math.max(best.candy, sessions.get(score)!.candy + sessions.get(100 - score)!.candy)
      }
      return best
    }
    const direct = Array.from({ length: 30 }, (_, index) => directAt(index + 1))
    for (const goal of ['catch', 'candy'] as const) {
      const max = Math.max(...direct.map((metric) => metric[goal]))
      expect(result[goal].value).toBe(max / 100)
      for (let strength = 1; strength <= 30; strength++) {
        const covered = result[goal].intervals.some((interval) => interval.min <= strength && (interval.max === null || strength <= interval.max))
        if (covered) expect(direct[strength - 1]![goal]).toBe(max)
      }
      expect(result[goal].intervals.every((interval) => interval.sleeps.reduce((sum, sleep) => sum + sleep.score, 0) === 100)).toBe(true)
    }
    expect(result.candy.value).toBeGreaterThanOrEqual(result.catch.value * 4)
  })

  it('represents a permanent optimal plateau without an artificial upper bound', () => {
    const fixed: EfficiencyIsland = { ...fixture, bands: [{ count: 3, min: 0 }], styles: [fixture.styles[0]!] }
    const result = searchBabyEfficiency({ ...DEFAULT_BABY_EFFICIENCY, precision: 'high', iterations: 100 }, () => {}, [fixed])
    expect(result.catch.value).toBe(6)
    expect(result.catch.intervals.some((interval) => interval.max === null && interval.sleeps.length === 2)).toBe(true)
  })

  it('selects the highest-reward sleep type for each session with repeated styles', () => {
    const mixedTypes: EfficiencyIsland = { ...fixture, bands: [{ count: 3, min: 0 }], styles: [
      fixture.styles[0]!,
      { sleepType: '深深入眠', special: false, catch: 0, candy: 12, unlockStrength: 1, dpr: 110 },
      ...Array.from({ length: 50 }, () => ({ sleepType: '深深入眠' as const, special: false, catch: 0, candy: 0, unlockStrength: 1, dpr: 112 })),
      ...Array.from({ length: 100 }, () => ({ sleepType: '安然入睡' as const, special: false, catch: 0, candy: 0, unlockStrength: 1, dpr: 0 })),
    ] }
    const result = searchBabyEfficiency({ ...DEFAULT_BABY_EFFICIENCY, precision: 'high', iterations: 100 }, () => {}, [mixedTypes])
    expect(result.candy.value).toBe(72)
    expect(result.candy.intervals.some((interval) => interval.sleeps.length === 2
      && interval.sleeps.every((sleep) => sleep.sleepTypes.includes('深深入眠')))).toBe(true)
  })

  it('reports sampled energies without claiming untested gaps are optimal', () => {
    const fixed: EfficiencyIsland = { ...fixture, bands: [{ count: 3, min: 0 }], styles: [fixture.styles[0]!,
      ...Array.from({ length: 12 }, (_, index) => ({ sleepType: '安然入睡' as const, special: false, catch: 0, candy: 0, unlockStrength: index + 2, dpr: 0 })),
    ] }
    const result = searchBabyEfficiency({ ...DEFAULT_BABY_EFFICIENCY, precision: 'low', iterations: 100 }, () => {}, [fixed])
    expect(result.catch.intervals.some((interval) => interval.max === null)).toBe(true)
    expect(result.catch.value).toBe(6)
    expect(result.catch.intervals.every((interval) => interval.max === null || interval.max >= interval.min)).toBe(true)
  })
})
