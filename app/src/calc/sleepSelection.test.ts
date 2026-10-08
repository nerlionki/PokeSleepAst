import { describe, expect, it } from 'vitest'
import { createSleepSelector, selectSleepStyle } from '../../../core/src/calc/sleepSelection'
import { sleepDraw, unlockedStyles } from './sleep'
import { SLEEP_STYLES } from './data'
import { recommendThree } from './catch'
const pool = [3, 10, 30, 20].map((dpr, order) => ({ dpr: dpr * 1e6, order }))
describe('RaenonX DPR examples', () => {
  it('keeps compiled weighted selection equivalent for all budget and terminal states', () => {
    const rows = [{ dpr: 10, order: 1, weight: 2 }, { dpr: 10, order: 2, weight: 1 }, { dpr: 30, order: 3, weight: 3 }]
    const select = createSleepSelector(rows, (item) => item.weight)
    for (const remaining of [0, 9, 10, 29, 30, 100]) for (const last of [false, true]) {
      for (const low of [false, true]) for (const roll of [0, 0.2, 0.5, 0.999]) {
        expect(select(remaining, last, () => roll, low)).toEqual(selectSleepStyle(rows, remaining, last, () => roll, (item) => item.weight, low))
      }
    }
  })
  it('permits repeats and spends the remaining budget on the last draw', () => {
    expect(selectSleepStyle(pool, 50e6, false, () => 0.6)?.dpr).toBe(30e6)
    expect(selectSleepStyle(pool, 20e6, false, () => 0.4)?.dpr).toBe(10e6)
    expect(selectSleepStyle(pool, 10e6, true, () => 0)?.dpr).toBe(10e6)
  })
  it('uses the minimum after exhaustion and maximum when power is abundant', () => {
    expect(selectSleepStyle(pool, 0, false, () => 0.5)?.dpr).toBe(3e6)
    expect(selectSleepStyle(pool, 170e6, true, () => 0)?.dpr).toBe(30e6)
  })
  it('uses game order to break low-power minimum ties', () => {
    expect(selectSleepStyle([{ dpr: 10, order: 9 }, { dpr: 10, order: 1 }], 300, false, () => 0, undefined, true)?.order).toBe(1)
  })
})
describe('integrated sleep selection', () => {
  const base = SLEEP_STYLES[0]!
  it('allows repeated ordinary styles without mutating the cached pool', () => {
    const rows = [{ ...base, dpr: 100_000, stars: 1, styleName: '普通睡姿' }]
    const result = sleepDraw('greengrass', '没有特征', 300_000, '大师20', 'map', () => 0.5, { pool: rows })
    expect(result.map((row) => row.pokeId)).toEqual([base.pokeId, base.pokeId, base.pokeId])
    expect(rows).toHaveLength(1)
  })
  it('shares the one-belly restriction across mixed and typed pools', () => {
    const rows = [{ ...base, dpr: 100_000, styleName: '大肚上睡', stars: 4 }, { ...base, id: 999, dpr: 1, styleName: '普通睡姿', stars: 1 }]
    const result = sleepDraw('greengrass', '淺淺入夢', 400_000, '大师20', 'normal', () => 0, { pool: rows, openPool: rows, eventMix: true })
    expect(result.filter((row) => row.styleName === '大肚上睡')).toHaveLength(1)
  })
  it('does not exempt one-star styles from their DPR threshold', () => {
    expect(unlockedStyles('greengrass', '没有特征', 0, '大师20', 'map')).toEqual([])
    const result = sleepDraw('greengrass', '没有特征', 300, '大师20')
    expect(new Set(result.map((row) => row.pokeId)).size).toBe(1)
  })
  it('generates only the recommendation type selected by the user', () => {
    expect(recommendThree([{ id: 'a', pokeId: 1, purpose: 'catch', stars: [] }], [], ['catch-candy']).map((row) => row.id)).toEqual(['catch-candy'])
    expect(recommendThree([], [], [])).toEqual([])
  })
})
