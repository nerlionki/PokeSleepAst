import { describe, expect, it } from 'vitest'
import { DEFAULT_COMPLETION_EFFICIENCY, EFFICIENCY_SLEEP_TYPES, efficiencyIslands, searchBabyEfficiency, validateBabyEfficiency, type EfficiencyIsland } from '../../../core/src/calc/babyEfficiency'
import { simulateEfficiencySlots } from '../../../core/src/calc/babyEfficiencyDraw'
import { missingCompletionStyles } from '../../../core/src/calc/completionEfficiency'
import { SLEEP_STYLES } from '../../../core/src/calc/data'
import { styleKey } from './sleep'

const keyOf = (style: typeof SLEEP_STYLES[number]) => styleKey(style.pokeId, style.stars, style.styleId)
const zero = { catch: 0, candy: 0 }
// 末位选择 order 较小的非目标，前两位各以 1/2 概率命中。
const fixture: EfficiencyIsland = {
  id: 'cyan', name: '测试岛', bands: [{ count: 3, min: 0 }],
  fallbacks: Object.fromEntries(EFFICIENCY_SLEEP_TYPES.map(type => [type, zero])) as EfficiencyIsland['fallbacks'],
  styles: [
    { sleepType: '深深入眠', special: false, catch: 0, candy: 0, dpr: 0, unlockStrength: 1, order: 0 },
    { sleepType: '深深入眠', special: false, catch: 1, candy: 0, dpr: 0, unlockStrength: 1, order: 1 },
  ],
}
const options = { ...DEFAULT_COMPLETION_EFFICIENCY, pokeId: 160, completionTarget: '160-4', iterations: 20000, precision: 'high' as const }

describe('completion efficiency', () => {
  it('only offers missing ordinary faces, deduplicated across islands', () => {
    expect(missingCompletionStyles({ sleepdexMode: 'all' })).toEqual([])
    const target = SLEEP_STYLES.find(style => style.pokeId === 160 && style.stars === 4)!
    const missing = missingCompletionStyles({ sleepdexMode: 'all', sleepdexExcluded: [keyOf(target)] })
    expect(missing).toHaveLength(1)
    expect(keyOf(missing[0]!)).toBe(keyOf(target))
    expect(missingCompletionStyles({ sleepdexMode: 'list', sleepdex: [keyOf(target)] }).some(style => keyOf(style) === keyOf(target))).toBe(false)
    expect(missingCompletionStyles({ sleepdexMode: 'list' }).some(style => style.limited)).toBe(false)
  })

  it('supports evolved species and only counts the exact face on eligible islands', () => {
    expect(validateBabyEfficiency(options)).toBeNull()
    expect(validateBabyEfficiency({ ...options, completionTarget: '160-99' })).toBeTruthy()
    const target = SLEEP_STYLES.find(style => style.pokeId === 132 && style.stars === 4 && style.styleId != null)!
    expect(target).toBeTruthy()
    const islands = efficiencyIslands(target.pokeId, keyOf(target))
    expect(islands.length).toBeGreaterThan(0)
    for (const island of islands) {
      const raw = SLEEP_STYLES.filter(style => style.island === island.id && !style.limited)
      island.styles.forEach((style, index) => {
        expect(style.catch).toBe(Number(keyOf(raw[index]!) === keyOf(target)))
        expect(style.candy).toBe(0)
      })
    }
  })

  it('counts hit runs separately from repeated target encounters', () => {
    const result = simulateEfficiencySlots({
      buckets: fixture.styles.map(style => ({ ...style, count: 1, typed: true })),
      power: 100, encounters: 3, otherSlots: 0, typedFallback: zero, openFallback: zero,
    }, 20000)
    expect(result.hitRuns / 20000).toBeCloseTo(0.75, 2)
    expect(result.catch / 20000).toBeCloseTo(1, 2)
    expect(result.catch).toBeGreaterThan(result.hitRuns)
  })

  it('combines daily independent misses and compares whole sleep with splits', () => {
    const whole = searchBabyEfficiency({ ...options, splitSleep: false }, undefined, [fixture])
    const split = searchBabyEfficiency(options, undefined, [fixture])
    expect(whole.catch.value).toBeCloseTo(0.75, 2)
    expect(split.catch.value).toBeCloseTo(1 - (1 - whole.catch.value) ** 2, 10)
    expect(split.catch.value).toBeLessThanOrEqual(1)
    expect(split.catch.intervals.length).toBeGreaterThan(0)
    expect(split.catch.intervals.every(interval => interval.sleeps.length === 2 && interval.sleeps.reduce((sum, sleep) => sum + sleep.score, 0) === 100)).toBe(true)
  })

  it('counts exhausted-budget fallback hits and never exceeds 100 percent', () => {
    const island = { ...fixture, styles: [], fallbacks: Object.fromEntries(EFFICIENCY_SLEEP_TYPES.map(type => [type, { catch: 1, candy: 0 }])) as EfficiencyIsland['fallbacks'] }
    const result = searchBabyEfficiency(options, undefined, [island])
    expect(result.catch.value).toBe(1)
    expect(result.catch.intervals.some(interval => interval.sleeps.length === 1)).toBe(true)
  })
})
