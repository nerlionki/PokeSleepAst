import { describe, expect, it } from 'vitest'
import type { BoxPokemon } from '../types'
import { candyRowFromBox } from './candyPlan'

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
