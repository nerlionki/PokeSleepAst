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
  it('includes ordinary berry finding and ingredient competition at full energy', () => {
    const mon = member()
    const seconds = instantInterval(species.interval, 60, '勤奋', [], 0, 100, false, 'greengrass', false)
    const berries = Math.floor(86400 / seconds * 10) / 10
    expect(berryRow(mon).amount).toBeLessThan(Math.floor(berries * berryEnergyAt(species.berry, 60)))
    expect(berryRow(member({ subskills: ['ingM', '', '', '', ''] })).amount).toBeLessThan(berryRow(mon).amount)
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
  it('includes skill ingredients even when ordinary ingredient slots remain locked', () => {
    const mons = [member({ uid: 'a', level: 1, ingredientSlots: [0, 1, 2] }), member({ uid: 'b', ingredientSlots: [0, 1, 2] })]
    const overview = calculateBoxOverview(mons)
    expect(overview.ingredients.find((ing) => ing.id === species.ingredients[0]!.id)!.rows).toHaveLength(2)
    for (const ingredient of species.ingredients.slice(1)) {
      const rows = overview.ingredients.find((ing) => ing.id === ingredient.id)!.rows
      expect(rows.map((row) => row.pokemon.uid).sort()).toEqual(['a', 'b'])
      expect(rows.find(row => row.pokemon.uid === 'b')!.amount).toBeGreaterThan(rows.find(row => row.pokemon.uid === 'a')!.amount)
    }
    expect(overview.ingredients.every((ing) => ing.rows.every((row) => row.amount > 0))).toBe(true)
  })
  it('excludes only missing fields relevant to the tab and current unlock level', () => {
    const mon = member({ level: 30, ocrMissing: ['skillLevel', 'ingredient2', 'subskill2', 'ingredient1'] })
    expect(criticalOverviewFields(mon, 'berries')).toEqual(['skillLevel'])
    expect(criticalOverviewFields(mon, 'ingredients')).toEqual(['skillLevel', 'ingredient1'])
    expect(calculateBoxOverview([mon]).excludedBerries).toEqual([mon])
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
    const unit = berryEnergyAt(species.berry, 60)
    const boostedUnit = Math.ceil(unit * 1.5) * 2
    expect(berryRow(mon, boosted).amount / berryRow(mon).amount).toBeCloseTo(boostedUnit / unit, 2)
    const plain = calculateBoxOverview([mon]).ingredients.map((ing) => ing.rows.map((row) => row.amount))
    expect(calculateBoxOverview([mon], boosted).ingredients.map((ing) => ing.rows.map((row) => row.amount))).toEqual(plain)
    expect(berryRow(mon, { ...defaultOverviewBonuses(), goodCamp: true }).amount).toBeGreaterThan(berryRow(mon).amount)
  })
})
