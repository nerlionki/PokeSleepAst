import { describe, expect, it } from 'vitest'
import { defaultSettings, mergeSettings } from './defaults'
import { sleepDraw, styleKey } from './sleep'
import { SLEEP_STYLES } from './data'
import { createSleepSelector, selectSleepStyle } from '../../../core/src/calc/sleepSelection'
import { MOON_POKEMON, normalizeEventMix, openSleepSlots, pokemonSleepWeight } from '../../../core/src/calc/sleepRules'

const face = (pokeId: number, dpr = 38_000) => ({ ...SLEEP_STYLES[0]!, pokeId, dpr, stars: 1, styleId: pokeId, styleName: '测试睡姿' })
describe('Wiki terminal and exhaustion selection', () => {
  const rows = [
    { dpr: 10, unlockRank: 2, order: 1, weight: 100 },
    { dpr: 10, unlockRank: 1, order: 9, weight: 1 },
    { dpr: 10, unlockRank: 1, order: 2, weight: 1 },
    { dpr: 20, unlockRank: 0, order: 1, weight: 1 },
  ]
  it('uses rank then internal ID for both exhausted and terminal draws, regardless of weight or RNG', () => {
    const compiled = createSleepSelector(rows, row => row.weight)
    for (const roll of [0, 0.5, 0.999]) for (const [remaining, last] of [[0, false], [10, true], [19, true]] as const) {
      expect(selectSleepStyle(rows, remaining, last, () => roll, row => row.weight)).toBe(rows[2])
      expect(compiled(remaining, last, () => roll)).toBe(rows[2])
    }
    expect(compiled(20, true, () => 0)).toBe(rows[3])
  })
  it('does not force a fixed result below the obsolete 90000 threshold when a style is affordable', () => {
    const result = sleepDraw('greengrass', '没有特征', 80_000, '大师20', 'normal', () => 0.999, {
      pool: [face(1, 76_000), face(4, 76_000)], undiscoveredBoost: false,
    })
    expect(result.map(row => row.pokeId)).toEqual([4, 1, 1])
  })
})
describe('global cross-type modes', () => {
  it('defaults new and legacy settings to some, while preserving explicit off/all', () => {
    expect(defaultSettings().sleepEventMix).toBe('some')
    expect(mergeSettings({ eventMult: 1.5 }).sleepEventMix).toBe('some')
    for (const mode of ['some', 'all'] as const) expect(mergeSettings({ sleepEventMix: mode }).sleepEventMix).toBe(mode)
    expect(mergeSettings({ sleepEventMix: 'off' }).sleepEventMix).toBe('some')
    expect(normalizeEventMix(true)).toBe('some')
    expect(normalizeEventMix(false)).toBe('off')
  })
  it('matches Wiki fixed-position counts for 3 through 8 encounters', () => {
    expect([3, 4, 5, 6, 7, 8].map(n => n - openSleepSlots(n, 'some'))).toEqual([1, 1, 2, 2, 2, 3])
    expect(openSleepSlots(8, 'off')).toBe(0)
    expect(openSleepSlots(8, 'all')).toBe(8)
  })
  it.each([['off', 0], ['some', 5], ['all', 8]] as const)('uses the correct pool including the final slot in %s mode', (eventMix, count) => {
    const rows = sleepDraw('greengrass', '安然入睡', 1e9, '大师20', 'normal', () => 0, {
      pool: [face(25)], openPool: [face(1)], eventMix, undiscoveredBoost: false,
    })
    expect(rows).toHaveLength(8)
    expect(rows.filter(row => row.pokeId === 1)).toHaveLength(count)
  })
})
describe('explicit simulator UP assumptions', () => {
  it('links only named moon presets to the three exact species', () => {
    for (const id of MOON_POKEMON) {
      expect(pokemonSleepWeight(id, 1.5)).toBe(6)
      for (const mult of [2, 2.5, 3, 4]) expect(pokemonSleepWeight(id, mult)).toBe(9)
      for (const mult of [1, 1.1, 1.3]) expect(pokemonSleepWeight(id, mult)).toBe(1)
    }
    expect(pokemonSleepWeight(25, 4)).toBe(1)
    expect(pokemonSleepWeight(25, 1, { small: [25] })).toBe(4)
    expect(pokemonSleepWeight(173, 1.5, { mid: [173, 173] })).toBe(6)
  })
  it('applies moon UP and missing-style weight to random slots without mutating pools', () => {
    const pool = [face(25, 1e6), face(173, 1e6)]
    const run = (eventMult: number, roll: number, undiscoveredBoost = false) => sleepDraw('greengrass', '没有特征', 3e6,
      '大师20', 'normal', () => roll, { pool, eventMult, undiscoveredBoost, discovered: [styleKey(25, 1, 25)] })
    expect(run(1, 0.3)[0]!.pokeId).toBe(25)
    expect(run(1.5, 0.3)[0]!.pokeId).toBe(173)
    expect(run(1.5, 0.1)[0]!.pokeId).toBe(25)
    expect(run(1.5, 0.1, true)[0]!.pokeId).toBe(173)
    expect(run(4, 0.3).at(-1)!.pokeId).toBe(25)
    expect(pool).toHaveLength(2)
  })
})


describe('efficiency engine parity with moon and cross-type rules', () => {
  it.each(['off', 'some', 'all'] as const)('matches sleep simulation for Cleffa with medium UP (%s)', async eventMix => {
    const { efficiencyIslands, efficiencyCurve, efficiencyDrawState } = await import('./babyEfficiency')
    const { simulateEfficiencyState } = await import('./babyEfficiencyDraw')
    const { sleepExpect, rankFromStrength } = await import('./sleep')
    const island = efficiencyIslands(173).find(row => row.id === 'greengrass')!
    const strength = 500_000, mult = 1.5, power = 100 * strength * mult, iterations = 4000
    const state = efficiencyCurve(island, 100, mult).filter(row => row.min <= strength).at(-1)!
    const total = simulateEfficiencyState(efficiencyDrawState(island, state, '深深入眠', eventMix, power), iterations)
    const rows = sleepExpect('greengrass', '深深入眠', power, iterations, 'normal', {
      rank: rankFromStrength('greengrass', strength), eventMult: mult, eventMix, undiscoveredBoost: false, seed: 1,
    })
    const catches = rows.filter(row => row.pokeId === 173).reduce((sum, row) => sum + row.count, 0)
    const candy = rows.filter(row => [173, 35, 36].includes(row.pokeId)).reduce((sum, row) => sum + row.candy, 0)
    expect(Math.abs(total.catch - catches) / iterations).toBeLessThan(0.1)
    expect(Math.abs(total.candy - candy) / iterations).toBeLessThan(0.5)
  }, 20000)
})
