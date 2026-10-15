import { describe, expect, it } from 'vitest'
import source from '../../../core/src/data/sleep-last-roll-source.json'
import { SLEEP_STYLES } from './data'
import { isLastRollExcluded } from '../../../core/src/calc/sleepLastRoll'
import { compareSleepPriority, createSleepSelector, selectSleepStyle } from '../../../core/src/calc/sleepSelection'
import { sleepStyleInternalId } from './sleepRewards'
import { sleepDraw } from './sleep'
import { babyEfficiencySteps, DEFAULT_BABY_EFFICIENCY, efficiencyCurve, efficiencyDrawState, type BabyEfficiencyCheckpoint, type EfficiencyIsland } from './babyEfficiency'
import { simulateEfficiencyState } from './babyEfficiencyDraw'
import { sleepSimulationSteps, type SleepSimulationCheckpoint } from '../../../core/src/calc/sleepSimulation'

describe('approved RAE terminal exclusions', () => {
  it('rejects sleep checkpoints produced before the terminal rule changed', () => {
    const checkpoint = { version: 3, powerIndex: 0, result: [] } as unknown as SleepSimulationCheckpoint
    expect(() => sleepSimulationSteps({ island: 'greengrass', sleepType: '没有特征', powers: [100], iterations: 1, seed: 1, options: {}, checkpoint }).next()).toThrow('睡姿抽选规则已更新')
  })

  it('rejects efficiency checkpoints carrying old terminal results', () => {
    const checkpoint = { version: 3, options: DEFAULT_BABY_EFFICIENCY } as unknown as BabyEfficiencyCheckpoint
    expect(() => babyEfficiencySteps(DEFAULT_BABY_EFFICIENCY, undefined, [], checkpoint).next()).toThrow('续算规则或参数与检查点不一致')
  })
  it('maps game internal IDs across islands, including Ditto variants and new styles', () => {
    expect(source.excludedInternalIds).toHaveLength(145)
    expect(new Set(source.excludedInternalIds).size).toBe(145)
    const affected = SLEEP_STYLES.filter(style => !style.limited && isLastRollExcluded(style))
    expect(affected).toHaveLength(598)
    expect(new Set(affected.map(sleepStyleInternalId)).size).toBe(131)
    for (const pokeId of [173, 35, 36, 132, 243, 244, 245, 150, 590, 591]) {
      const styles = SLEEP_STYLES.filter(style => !style.limited && style.pokeId === pokeId)
      expect(styles.length).toBeGreaterThan(0)
      expect(styles.every(isLastRollExcluded)).toBe(true)
    }
    expect(SLEEP_STYLES.filter(style => style.pokeId === 25 && !style.limited).every(style => !isLastRollExcluded(style))).toBe(true)
  })

  const pool = [
    { dpr: 10, order: 2, unlockRank: 0, lastRollExcluded: true, weight: 3 },
    { dpr: 10, order: 3, unlockRank: 1, weight: 1 },
    { dpr: 20, order: 8, unlockRank: 1, lastRollExcluded: true, weight: 3 },
    { dpr: 20, order: 9, unlockRank: 1, weight: 1 },
    { dpr: 20, order: 12, unlockRank: 0, weight: 1 },
    { dpr: 30, order: 1, unlockRank: 0, lastRollExcluded: true, weight: 3 },
  ]

  it('retains excluded ordinary draws and selects the best eligible terminal candidate', () => {
    expect(selectSleepStyle(pool, 30, false, () => 0.999, row => row.weight)).toBe(pool[5])
    expect(selectSleepStyle(pool, 30, true, () => 0)).toBe(pool[4])
    expect(selectSleepStyle(pool, 19, true, () => 0)).toBe(pool[1])
    expect(selectSleepStyle(pool, 0, false, () => 0)).toBe(pool[0])
    expect(selectSleepStyle(pool, 0, true, () => 0)).toBe(pool[1])
    expect(selectSleepStyle([pool[0]!], 100, true, () => 0)).toBeUndefined()
  })

  it('keeps the compiled selector equivalent at exclusions, ties and exhausted budgets', () => {
    for (const rows of [pool, pool.filter(row => row.lastRollExcluded), []]) {
      const select = createSleepSelector(rows, row => row.weight)
      // Compiled random draws visit DPR/priority order; compare identical traversal.
      const ordered = [...rows].sort((a, b) => a.dpr - b.dpr || compareSleepPriority(a, b))
      for (const remaining of [0, 9, 10, 19, 20, 29, 30, 100]) {
        for (const last of [false, true]) for (const low of [false, true]) {
          for (const random of [0, 0.2, 0.5, 0.999]) {
            expect(select(remaining, last, () => random, low)).toBe(selectSleepStyle(ordered, remaining, last, () => random, row => row.weight, low))
          }
        }
      }
    }
  })

  it('applies the source to real sleep draws while preserving the cached pool', () => {
    const excluded = SLEEP_STYLES.find(style => style.island === 'greengrass' && style.pokeId === 173 && style.stars === 1)!
    const eligible = SLEEP_STYLES.find(style => style.island === 'greengrass' && style.pokeId === 25 && style.stars === 1)!
    const rows = [{ ...excluded, dpr: 20 }, { ...eligible, dpr: 10 }]
    const draw = sleepDraw('greengrass', '没有特征', 100, '大师20', 'normal', () => 0, { pool: rows, undiscoveredBoost: false })
    expect(draw.map(style => style.pokeId)).toEqual([173, 173, 25])
    expect(rows).toHaveLength(2)
    expect(rows[0]!.dpr).toBe(20)
  })

  it('keeps terminal eligibility separate when efficiency rewards and costs match', () => {
    const zero = { catch: 0, candy: 0 }
    const fixture: EfficiencyIsland = {
      id: 'greengrass', name: '测试岛', bands: [{ count: 3, min: 0 }],
      fallbacks: { 淺淺入夢: zero, 安然入睡: zero, 深深入眠: zero, 没有特征: zero },
      styles: [
        { sleepType: '淺淺入夢', special: false, unlockStrength: 1, dpr: 10, order: 1, catch: 1, candy: 1, lastRollExcluded: true },
        { sleepType: '淺淺入夢', special: false, unlockStrength: 1, dpr: 10, order: 9, catch: 1, candy: 1, lastRollExcluded: false },
      ],
    }
    const curve = efficiencyCurve(fixture, 100, 1)[0]!
    const state = efficiencyDrawState(fixture, curve, '淺淺入夢', 'off', 100)
    expect(state.buckets).toHaveLength(2)
    expect(state.buckets.map(row => row.lastRollExcluded).sort()).toEqual([false, true])
    const last = createSleepSelector(state.buckets)(100, true, () => 0)
    expect(last?.order).toBe(9)
    expect(simulateEfficiencyState(state, 1, () => 0)).toEqual({ catch: 3, candy: 3 })
  })
})

describe('user-confirmed SPO ID priority for equal DPR', () => {
  const candidates = [
    { dpr: 100, spoId: 77, unlockRank: 0, order: 1 },
    { dpr: 100, spoId: 75, unlockRank: 5, order: 999 },
    { dpr: 200, spoId: 90, unlockRank: 6, order: 1000 },
  ]

  it('prefers lower SPO ID before rank and internal ID without overriding the DPR budget', () => {
    const compiled = createSleepSelector(candidates)
    for (const last of [false, true]) {
      expect(selectSleepStyle(candidates, 0, last, () => 0)).toBe(candidates[1])
      expect(compiled(0, last, () => 0)).toBe(candidates[1])
    }
    expect(selectSleepStyle(candidates, 199, true, () => 0)).toBe(candidates[1])
    expect(compiled(199, true, () => 0)).toBe(candidates[1])
    expect(selectSleepStyle(candidates, 200, true, () => 0)).toBe(candidates[2])
    expect(compiled(200, true, () => 0)).toBe(candidates[2])
    // Ordinary draws still follow their configured weight, even with a higher SPO ID.
    expect(selectSleepStyle(candidates, 199, false, () => 0, () => 1)).toBe(candidates[0])
  })

  it('falls back to rank and internal ID only after SPO IDs tie or are missing', () => {
    expect(compareSleepPriority({ dpr: 1, spoId: 75, unlockRank: 0, order: 9 }, { dpr: 1, spoId: 75, unlockRank: 1, order: 1 })).toBeLessThan(0)
    expect(compareSleepPriority({ dpr: 1, spoId: 75, unlockRank: 0, order: 1 }, { dpr: 1, spoId: 75, unlockRank: 0, order: 9 })).toBeLessThan(0)
    expect(compareSleepPriority({ dpr: 1, unlockRank: 0, order: 1 }, { dpr: 1, unlockRank: 1, order: 9 })).toBeLessThan(0)
  })

  it('reads distinct source SPO IDs for the EX2 Shuckle/Swampert equal-DPR case', () => {
    const shuckle = SLEEP_STYLES.find(style => style.island === 'cyanex' && style.pokeId === 213 && style.stars === 3)!
    const swampert = SLEEP_STYLES.find(style => style.island === 'cyanex' && style.pokeId === 260 && style.stars === 3)!
    expect(shuckle.dpr).toBe(swampert.dpr)
    expect([shuckle.spoId, swampert.spoId]).toEqual([75, 77])
    expect(selectSleepStyle([swampert, shuckle], Infinity, true, () => 0)).toBe(shuckle)
    expect(createSleepSelector([swampert, shuckle])(Infinity, true, () => 0)).toBe(shuckle)
  })

  it.each([false, true])('preserves the winning SPO ID through efficiency aggregation (mixed=%s)', mixed => {
    const zero = { catch: 0, candy: 0 }
    const island: EfficiencyIsland = {
      id: 'greengrass', name: '测试岛', bands: [{ count: 3, min: 0 }],
      fallbacks: { 淺淺入夢: zero, 安然入睡: zero, 深深入眠: zero, 没有特征: zero },
      styles: [
        { sleepType: '淺淺入夢', special: false, unlockStrength: 1, dpr: 10, spoId: 77, unlockRank: 0, order: 1, catch: 1, candy: 1 },
        { sleepType: mixed ? '安然入睡' : '淺淺入夢', special: false, unlockStrength: 1, dpr: 10, spoId: 75, unlockRank: 5, order: 9, catch: 1, candy: 1 },
      ],
    }
    const state = efficiencyDrawState(island, efficiencyCurve(island, 100, 1)[0]!, '没有特征', 'off', 100)
    expect(state.buckets).toHaveLength(1)
    expect(state.buckets[0]).toMatchObject({ spoId: 75, order: 9, unlockRank: 5, count: 2 })
  })
})
