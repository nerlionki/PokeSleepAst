import { describe, expect, it } from 'vitest'
import { defaultSettings } from '../../../core/src/calc/defaults'
import { exEffects } from '../../../core/src/calc/exEffects'
import { produce } from '../../../core/src/calc/produce'
import { teamHelpingBonus } from '../../../core/src/calc/timeline'
import { pokeById } from '../../../core/src/calc/data'
import type { BoxPokemon, Settings } from '../../../core/src/types'
const member: BoxPokemon = { uid: 'one', pokeId: 7, level: 30, nature: '勤奋', subskills: ['helpingBonus', '', '', '', ''], ingredientSlots: [0, 0, 0], skillLevel: 1, name: '', napping: false }
const berry = pokeById(7)!.berry
const settings = (): Settings => ({ ...defaultSettings(), island: 'greenex', berries: [berry, '金枕果', '柿仔果'] })
describe('EX production and extra helping bonus', () => {
  it('gives only the main berry the speed and skill level bonuses', () => {
    const s = settings()
    expect(exEffects(s, berry).speed).toBe(0.9)
    expect(exEffects(s, berry).skillLevels).toBe(1)
    expect(exEffects(s, '金枕果').speed).toBe(1)
    expect(exEffects(s, '金枕果').skillLevels).toBe(0)
    expect(exEffects(s, '萄葡果').speed).toBe(1.15)
    expect(exEffects({ ...s, exBuff: false }, berry).speed).toBe(1)
    expect(exEffects({ ...s, exDebuff: false }, '萄葡果').speed).toBe(1)
  })
  it('uses distinct island rules and ignores EX flags on ordinary islands', () => {
    const s = { ...settings(), island: 'cyanex' as const }
    expect(exEffects(s, berry).speed).toBe(0.8)
    expect(exEffects(s, '萄葡果').speed).toBe(1.35)
    expect(exEffects({ ...s, island: 'cyan' }, berry).speed).toBe(1)
  })
  it('applies exactly one weekly bonus to main and secondary berries', () => {
    const s = { ...settings(), exWeeklyBonus: 'ingredients' as const }
    expect(exEffects(s, berry, '食材型').ingredientExtra).toBe(1.5)
    expect(exEffects(s, '金枕果', '技能型').ingredientExtra).toBe(1)
    expect(exEffects(s, '萄葡果', '食材型').ingredientExtra).toBe(0)
    expect(exEffects(s, berry).berryMultiplier).toBe(2)
    expect(exEffects(s, berry).skillMultiplier).toBe(1)
  })
  it('changes actual berry energy, ordinary food and skill production', () => {
    const input = { ...member, wakeEnergy: 100, carryMode: 'unlimited' as const }
    const s = settings(), base = produce(s, input)
    const berries = produce({ ...s, exWeeklyBonus: 'berries' }, input)
    expect(berries.berryEnergy / base.berryEnergy).toBeCloseTo(1.2, 3)
    expect(berries.ingredients).toEqual(base.ingredients)
    const food = produce({ ...s, exWeeklyBonus: 'ingredients' }, input)
    expect(Object.values(food.ingredients).reduce((a, b) => a + b, 0)).toBeGreaterThan(Object.values(base.ingredients).reduce((a, b) => a + b, 0))
    const skill = produce({ ...s, exWeeklyBonus: 'skills' }, input)
    expect(skill.skillProcs).toBeGreaterThan(base.skillProcs)
    expect(produce({ ...s, exWeeklyBonus: 'ingredients' }, { ...input, carryMode: 'full' }).ingredients).toEqual({})
  })
  it('adds extra gold helping bonuses to unlocked team bonuses, capping at five', () => {
    expect(teamHelpingBonus([member], 2)).toBe(3)
    expect(teamHelpingBonus([member], 5)).toBe(5)
    expect(teamHelpingBonus([{ ...member, subskills: ['', '', 'helpingBonus', '', ''] }], 2)).toBe(2)
    expect(teamHelpingBonus([], -1)).toBe(0)
  })
})
