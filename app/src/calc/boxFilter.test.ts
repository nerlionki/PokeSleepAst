import { describe, expect, it } from 'vitest'
import { pokeById } from './data'
import { FILTER_CATALOG, boxLabel, boxMatches, type BoxQuery, EMPTY_BOX_QUERY } from './boxFilter'
import { BERRIES, INGREDIENTS, SUBSKILLS } from './data'
import { MAIN_SKILLS } from './mainSkills'
import type { BoxPokemon } from '../types'

function mon(partial: Partial<BoxPokemon> & Pick<BoxPokemon, 'pokeId'>): BoxPokemon {
  return {
    uid: partial.uid ?? 'u',
    pokeId: partial.pokeId,
    level: partial.level ?? 30,
    nature: partial.nature ?? '勤奋',
    subskills: partial.subskills ?? ['', '', '', '', ''],
    ingredientSlots: partial.ingredientSlots ?? [0, 1, 2],
    skillLevel: partial.skillLevel ?? 1,
    name: partial.name ?? '',
    napping: partial.napping ?? false,
  }
}

function query(partial: Partial<BoxQuery> = {}): BoxQuery {
  return { ...EMPTY_BOX_QUERY, ...partial }
}

describe('box filter', () => {
  const pika = pokeById(25)!
  const apple = pika.ingredients[0]!.name
  const ginger = pika.ingredients[1]!.name

  it('uses the species name until a custom name is set', () => {
    expect(boxLabel(mon({ pokeId: 25 }))).toBe('皮卡丘')
    expect(boxLabel(mon({ pokeId: 25, name: '闪电' }))).toBe('闪电')
    expect(boxMatches(mon({ pokeId: 25, name: '闪电' }), query({ text: '皮卡丘' }))).toBe(false)
    expect(boxMatches(mon({ pokeId: 25, name: '闪电' }), query({ text: '闪' }))).toBe(true)
    expect(boxMatches(mon({ pokeId: 25 }), query({ text: '皮卡丘' }))).toBe(true)
  })

  it('treats locked ingredient slots separately from unlocked ones', () => {
    const young = mon({ pokeId: 25, level: 10, ingredientSlots: [0, 1, 0] })
    expect(boxMatches(young, query({ ingredients: [apple], ingredientLock: 'unlocked' }))).toBe(true)
    expect(boxMatches(young, query({ ingredients: [apple], ingredientLock: 'locked' }))).toBe(false)
    expect(boxMatches(young, query({ ingredients: [ginger], ingredientLock: 'unlocked' }))).toBe(false)
    expect(boxMatches(young, query({ ingredients: [ginger], ingredientLock: 'locked' }))).toBe(true)
    expect(boxMatches(young, query({ ingredients: [apple, ginger], ingredientLock: 'unlocked' }))).toBe(true)
    expect(boxMatches(young, query({ ingredients: [apple, ginger], ingredientLock: 'locked' }))).toBe(true)
  })

  it('applies and/or against subskill unlock state', () => {
    const mixed = mon({ pokeId: 25, level: 10, subskills: ['helpingBonus', 'ingM', '', '', ''] })
    const both = ['helpingBonus', 'ingM']
    expect(boxMatches(mixed, query({ subskills: both, subskillLock: 'unlocked', subskillCombine: 'and' }))).toBe(false)
    expect(boxMatches(mixed, query({ subskills: both, subskillLock: 'locked', subskillCombine: 'and' }))).toBe(true)
    expect(boxMatches(mixed, query({ subskills: both, subskillLock: 'unlocked', subskillCombine: 'or' }))).toBe(true)
    expect(boxMatches(mixed, query({ subskills: ['helpingBonus'], subskillLock: 'locked', subskillCombine: 'or' }))).toBe(false)
    const grown = mon({ pokeId: 25, level: 30, subskills: ['helpingBonus', 'ingM', '', '', ''] })
    expect(boxMatches(grown, query({ subskills: both, subskillLock: 'locked', subskillCombine: 'and' }))).toBe(false)
    expect(boxMatches(grown, query({ subskills: both, subskillLock: 'unlocked', subskillCombine: 'and' }))).toBe(true)
  })

  it('includes all-rounders in each specialty and keeps them alone under 全能型', () => {
    const darkrai = mon({ pokeId: 491, level: 50 })
    const pikaMon = mon({ pokeId: 25, level: 50 })
    expect(boxMatches(darkrai, query({ specialty: '技能型' }))).toBe(true)
    expect(boxMatches(darkrai, query({ specialty: '树果型' }))).toBe(true)
    expect(boxMatches(darkrai, query({ specialty: '全能型' }))).toBe(true)
    expect(boxMatches(pikaMon, query({ specialty: '全能型' }))).toBe(false)
    expect(boxMatches(pikaMon, query({ specialty: '树果型' }))).toBe(true)
    expect(boxMatches(darkrai, query({ berryType: '电' }))).toBe(false)
  })

  it('lists every berry, ingredient, main skill, and subskill', () => {
    expect(FILTER_CATALOG.berries).toHaveLength(BERRIES.length)
    expect(FILTER_CATALOG.berries.map((item) => item.type)).toContain('电')
    expect(FILTER_CATALOG.ingredients).toHaveLength(INGREDIENTS.length)
    expect(FILTER_CATALOG.ingredients.map((item) => item.name)).toEqual(expect.arrayContaining([apple, ginger]))
    expect(FILTER_CATALOG.subskills).toHaveLength(SUBSKILLS.length)
    expect(FILTER_CATALOG.skills).toHaveLength(MAIN_SKILLS.length)
    expect(boxMatches(mon({ pokeId: 25, level: 30 }), query({ mainSkill: '能量填充S' }))).toBe(true)
  })
})
