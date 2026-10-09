import { describe, expect, it } from 'vitest'
import { calculateBoxOverview, criticalOverviewFields, defaultOverviewBonuses } from '../../../core/src/calc/boxOverview'
import { POKEDEX } from './data'
import { berryEnergyAt } from './berry'
import { instantInterval } from '../../../core/src/calc/helpSpeed'
import type { BoxPokemon } from '../../../core/src/types'
const species = POKEDEX.find((poke) => poke.specialty === '食材型' && poke.ingredients.length === 3)!
const member = (patch: Partial<BoxPokemon> = {}): BoxPokemon => ({ uid: 'a', pokeId: species.id, level: 60, nature: '勤奋', subskills: ['', '', '', '', ''], ingredientSlots: [0, 0, 0], skillLevel: 1, name: '', napping: false, ...patch })
const berryRow = (mon: BoxPokemon, bonuses = defaultOverviewBonuses()) => calculateBoxOverview([mon], bonuses).berries.find((berry) => berry.name === species.berry)!.rows[0]!
describe('Box overview production', () => {
  it('uses full-energy 24-hour sneaky snacking, independent of ingredient finding rate', () => {
    const mon = member()
    const seconds = instantInterval(species.interval, 60, '勤奋', [], 0, 100, false, 'greengrass', false)
    const berries = Math.floor(86400 / seconds * 10) / 10
    expect(berryRow(mon).amount).toBe(Math.floor(berries * berryEnergyAt(species.berry, 60)))
    expect(berryRow(member({ subskills: ['ingM', '', '', '', ''] })).amount).toBe(berryRow(mon).amount)
  })
  it('ranks individual Box entries and keeps exactly three per berry with stable ties', () => {
    const members = ['e', 'd', 'c', 'b', 'a'].map((uid) => member({ uid }))
    const original = JSON.stringify(members)
    const rows = calculateBoxOverview(members).berries.find((berry) => berry.name === species.berry)!.rows
    expect(rows.map((row) => row.pokemon.uid)).toEqual(['a', 'b', 'c'])
    expect(JSON.stringify(members)).toBe(original)
    members[4]!.level = 1
    expect(calculateBoxOverview(members).berries.find((berry) => berry.name === species.berry)!.rows.map((row) => row.pokemon.uid)).toEqual(['b', 'c', 'd'])
  })
  it('includes only unlocked ingredient slots and returns all individual contributors', () => {
    const mons = [member({ uid: 'a', level: 1, ingredientSlots: [0, 1, 2] }), member({ uid: 'b', ingredientSlots: [0, 1, 2] })]
    const overview = calculateBoxOverview(mons)
    expect(overview.ingredients.find((ing) => ing.id === species.ingredients[0]!.id)!.rows).toHaveLength(2)
    expect(overview.ingredients.find((ing) => ing.id === species.ingredients[1]!.id)!.rows.map((row) => row.pokemon.uid)).toEqual(['b'])
    expect(overview.ingredients.find((ing) => ing.id === species.ingredients[2]!.id)!.rows.map((row) => row.pokemon.uid)).toEqual(['b'])
    expect(overview.ingredients.every((ing) => ing.rows.every((row) => row.amount > 0))).toBe(true)
  })
  it('excludes only missing fields relevant to the tab and current unlock level', () => {
    const mon = member({ level: 30, ocrMissing: ['skillLevel', 'ingredient2', 'subskill2', 'ingredient1'] })
    expect(criticalOverviewFields(mon, 'berries')).toEqual([])
    expect(criticalOverviewFields(mon, 'ingredients')).toEqual(['ingredient1'])
    expect(calculateBoxOverview([mon]).excludedBerries).toEqual([])
    expect(calculateBoxOverview([mon]).excludedIngredients).toEqual([mon])
    expect(criticalOverviewFields(member({ ocrMissing: ['subskill0', 'nature'] }), 'berries')).toEqual(['subskill0', 'nature'])
  })
  it('counts one own helping bonus layer, respecting unlocks and the five-layer cap', () => {
    const own = member({ subskills: ['helpingBonus', '', '', '', ''] })
    expect(berryRow(own).amount).toBe(berryRow(member(), { ...defaultOverviewBonuses(), helpingBonus: 1 }).amount)
    expect(berryRow(own, { ...defaultOverviewBonuses(), helpingBonus: 4 }).amount).toBe(berryRow(own, { ...defaultOverviewBonuses(), helpingBonus: 5 }).amount)
    expect(berryRow(member({ level: 1, subskills: ['helpingBonus', '', '', '', ''] })).amount).toBe(berryRow(member({ level: 1 })).amount)
  })
  it('applies favored berries, area and camp locally without affecting ingredient quantities through area bonuses', () => {
    const mon = member()
    const boosted = { ...defaultOverviewBonuses(), areaBonus: 0.5, favoredBerries: [species.berry] }
    const seconds = instantInterval(species.interval, 60, '勤奋', [], 0, 100, false, 'greengrass', false)
    const berries = Math.floor(86400 / seconds * 10) / 10
    expect(berryRow(mon, boosted).amount).toBe(Math.floor(berries * berryEnergyAt(species.berry, 60) * 3))
    const plain = calculateBoxOverview([mon]).ingredients.map((ing) => ing.rows.map((row) => row.amount))
    expect(calculateBoxOverview([mon], boosted).ingredients.map((ing) => ing.rows.map((row) => row.amount))).toEqual(plain)
    expect(berryRow(mon, { ...defaultOverviewBonuses(), goodCamp: true }).amount).toBeGreaterThan(berryRow(mon).amount)
  })
})
