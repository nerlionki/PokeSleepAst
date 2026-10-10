import { afterEach, describe, expect, it, vi } from 'vitest'
import * as coreData from '../../../core/src/calc/data'
import { cookEnergy, recipeLevelMult, recipeLevelOf } from './cook'
import { defaultSettings } from './defaults'
import { clampSkillLevel, MAIN_SKILLS } from './mainSkills'
import { effectiveSkillLevel } from './member'
import { produce } from './produce'
import { RECIPE_LEVELS } from './recipes'
import { chargeStrength, skillValue } from './skills'
import { skillStorageLimit } from './specialty'
import { simulateTeam } from './timeline'

afterEach(() => vi.restoreAllMocks())

describe('recipe level limit', () => {
  it('calculates level 70 and clamps higher saved levels', () => {
    expect(RECIPE_LEVELS.at(-1)).toBe(70)
    expect(recipeLevelMult(70)).toBeCloseTo(3.58)
    expect(recipeLevelMult(100)).toBe(recipeLevelMult(70))
    expect(recipeLevelOf({ ...defaultSettings(), recipeLevels: { test: 100 } }, 'test')).toBe(70)
    expect(cookEnergy('特選蘋果咖哩', 0, false, 70)).toBeGreaterThan(cookEnergy('特選蘋果咖哩', 0, false, 60))
  })
})

describe('main skill table limits and values', () => {
  it.each(MAIN_SKILLS)('caps $name and subskill boosts at its table maximum', skill => {
    const name = skill.aliases[0]!
    expect(clampSkillLevel(name, 100)).toBe(skill.maxLevel)
    expect(effectiveSkillLevel(100, skill.maxLevel, ['skillLevelS', 'skillLevelM'], name)).toBe(skill.maxLevel)
    expect(effectiveSkillLevel(100, skill.maxLevel - 1, ['skillLevelS', 'skillLevelM'], name)).toBe(skill.maxLevel)
    expect(effectiveSkillLevel(1, 1, ['skillLevelS', 'skillLevelM'], name)).toBe(1)
  })

  it('uses full table effects for level 7 and 8 rather than a six-level array', () => {
    expect(chargeStrength('能量填充S(X)', 7)).toBe(3212)
    expect(chargeStrength('能量填充M', 7)).toBe(6858)
    expect(chargeStrength('夢魘（能量填充M）', 7)).toBe(18515)
    expect(chargeStrength('波導彈（夢之碎片獲取S）', 8)).toBe(2042)
    expect(chargeStrength('能量填充S(X~Y)', 7)).toBe(4015)
    expect(chargeStrength('蓄力（能量填充S）', 7)).toBe(4502)
    expect(skillValue('幫手支援S', 7)).toBe(12)
    expect(skillValue('活力全體療癒S', 100)).toBe(18.1)
    expect(clampSkillLevel('unknown', 100)).toBe(6)
    expect(chargeStrength('unknown', 8)).toBe(0)
  })

  it('uses level 7 and caps subskill boosts in individual production', () => {
    const input = { pokeId: 181, level: 100, nature: '勤奋', subskills: [], ingredientSlots: [0, 0, 0] as [number, number, number], skillLevel: 6 }
    const settings = defaultSettings()
    const six = produce(settings, input)
    const seven = produce(settings, { ...input, skillLevel: 7 })
    const boosted = produce(settings, { ...input, subskills: ['skillLevelS', 'skillLevelM'] })
    const over = produce(settings, { ...input, skillLevel: 8 })
    expect(seven.skillEnergy).toBe(Math.floor(seven.skillProcs * 6858))
    expect(seven.skillEnergy).toBeGreaterThan(six.skillEnergy)
    expect(boosted.skillEnergy).toBe(seven.skillEnergy)
    expect(over.skillEnergy).toBe(seven.skillEnergy)
  })

  it('uses level 8 in production and caps boosts in both calculation paths', () => {
    const input = { pokeId: 448, level: 100, nature: '勤奋', subskills: ['skillLevelS', 'skillLevelM'], ingredientSlots: [0, 0, 0] as [number, number, number], skillLevel: 7 }
    const settings = { ...defaultSettings(), meals: false, sleepStart: '00:00', sleepEnd: '00:00' }
    const seven = produce(settings, { ...input, subskills: [] })
    const eight = produce(settings, { ...input, subskills: [], skillLevel: 8 })
    const boosted = produce(settings, input)
    expect(eight.skillEnergy).toBe(Math.floor(eight.skillProcs * 2042))
    expect(eight.skillEnergy).toBeGreaterThan(seven.skillEnergy)
    expect(boosted.skillEnergy).toBe(eight.skillEnergy)
    const team = simulateTeam(settings, [input], 0, { alwaysProc: true })
    expect(team.members[0]!.skillEnergy).toBe(team.members[0]!.skillProcs * 2042)
    expect(team.events.every(event => event.note === 'charge +2042')).toBe(true)
  })
})

describe('skill storage during sleep', () => {
  it.each([['技能型', 2], ['全部', 2], ['树果型', 1], ['食材型', 1]] as const)('stores at most %s capacity and flushes it after waking', (specialty, limit) => {
    expect(skillStorageLimit(specialty)).toBe(limit)
    const poke = coreData.POKEDEX.find(row => row.id === 181)!
    vi.spyOn(coreData, 'pokeById').mockReturnValue({ ...poke, specialty, interval: 120, skillRate: 1, ingredientRate: 0 })
    const input = { pokeId: poke.id, level: 1, nature: '勤奋', subskills: [], ingredientSlots: [0, 0, 0] as [number, number, number], skillLevel: 7, wakeEnergy: 0, carryMode: 'unlimited' as const }
    const result = simulateTeam({ ...defaultSettings(), sleepStart: '00:00', sleepEnd: '23:59', meals: false }, [input], 0, { alwaysProc: true })
    expect(result.events).toHaveLength(limit)
    expect(result.events.every(event => event.minute === 1439)).toBe(true)
    expect(result.members[0]!.skillProcs).toBe(limit)
    expect(result.members[0]!.skillEnergy).toBe(limit * 6858)
  })
})
