import { describe, expect, it } from 'vitest'
import type { BoxPokemon } from '../types'
import { candyRowFromBox, familyOf, migrateCandyStocks, planCandy, type CandyRow } from './candyPlan'

function boxed(partial: Partial<BoxPokemon>): BoxPokemon {
  return {
    uid: 'a',
    pokeId: 25,
    level: 12,
    nature: '勤奋',
    subskills: ['', '', '', '', ''],
    ingredientSlots: [0, 1, 2],
    skillLevel: 1,
    name: '',
    napping: false,
    ...partial,
  }
}

describe('candy row from box', () => {
  it('copies species, level and aims at the next common level', () => {
    const row = candyRowFromBox(boxed({ pokeId: 25, level: 12 }))
    expect(row).toMatchObject({ pokeId: 25, start: 12, target: 25, method: 'target', nature: 'flat', remaining: null })
    expect(row.id).toBeTruthy()
    expect(candyRowFromBox(boxed({ level: 30 })).target).toBe(50)
    expect(candyRowFromBox(boxed({ level: 70 })).target).toBe(70)
  })

  it('maps the EXP nature and the exp still needed', () => {
    expect(candyRowFromBox(boxed({ nature: '胆小' })).nature).toBe('up')
    expect(candyRowFromBox(boxed({ nature: '勇敢' })).nature).toBe('down')
    const row = candyRowFromBox(boxed({ tune: { evolutions: 0, goldSeeds: 0, silverSeeds: 0, sleepHours: 0, carryMode: 'preset', exp: 120, ribbonHours: 0 } }))
    expect(row.remaining).toBe(120)
  })
})

describe('shared candy families and legacy stocks', () => {
  it.each([
    [[710, 711, 71002, 71003, 71004, 71102, 71103, 71104], '195'],
    [[37, 38, 7006, 7007], '133'], [[194, 980, 7054], '146'],
    [[848, 849, 8001], '191'], [[172, 25, 26, 9001, 9002, 9007], '1'],
    [[133, 9004, 9005], '2'], [[363, 364, 365, 9006], '102'],
    [[590, 591], '236'],
  ] as const)('groups variants %s in family %s', (ids, family) => {
    for (const id of ids) expect(familyOf(id)).toBe(family)
  })

  it('takes the maximum, preserves unrelated keys and is idempotent', () => {
    const saved = { '195': 30, '71002': 50, '71104': 40, '133': 22, '7006': 18, '9001': 45, '9007': 30, '590': 12, '591': 20, 'unknown': 7 }
    const migrated = migrateCandyStocks(saved)
    expect(migrated).toEqual({ '195': 50, '133': 22, '1': 45, '236': 20, 'unknown': 7 })
    expect(migrateCandyStocks(migrated)).toEqual(migrated)
    expect(saved['71002']).toBe(50)
    // 家族 133 是六尾家族，不能再按宝可梦 133（伊布）重映射到家族 2。
    expect(migrated['2']).toBeUndefined()
  })

  it('counts shortages against a single shared stock across regional forms', () => {
    const row = (pokeId: number): CandyRow => ({ id: String(pokeId), pokeId, method: 'manual', start: 1, target: 30, use: 10, useAll: false, nature: 'flat', remaining: null })
    const plan = planCandy([row(37), row(7006)], { '133': 15 }, 'mini')
    // 手动规划保留两行各喂 10 颗的需求，第二行报告同家族库存不足。
    expect(plan.candies).toBe(20)
    expect(plan.results[0]!.candies).toBe(10)
    expect(plan.results[1]!.candies).toBe(10)
    expect(plan.results[1]!.missing).toBe(5)
    expect(plan.missing).toBe(5)
  })
})
