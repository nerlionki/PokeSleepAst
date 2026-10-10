import type { BoxPokemon, OcrMissingField, IslandId, Settings } from '../types'
import { BERRIES, INGREDIENTS, pokeById } from './data'
import { defaultSettings } from './defaults'
import { SUBSKILL_GATES, unlockedSubskills } from './member'
import { normalizeOcrMissing } from './ocrCompletion'
import { produce } from './produce'

export interface OverviewBonuses {
  island?: IslandId
  exBuff?: boolean
  exDebuff?: boolean
  exWeeklyBonus?: Settings['exWeeklyBonus']
  areaBonus: number
  goodCamp: boolean
  helpingBonus: number
  favoredBerries: string[]
}
export const defaultOverviewBonuses = (): OverviewBonuses => ({ island: 'greengrass', exBuff: true, exDebuff: true, exWeeklyBonus: 'none', areaBonus: 0, goodCamp: false, helpingBonus: 0, favoredBerries: [] })
export interface OverviewRank { pokemon: BoxPokemon; amount: number }
export function criticalOverviewFields(pokemon: BoxPokemon, mode: 'berries' | 'ingredients'): OcrMissingField[] {
  return normalizeOcrMissing(pokemon.ocrMissing).filter((field) => {
    if (field === 'level' || field === 'nature') return true
    if (field.startsWith('subskill')) return pokemon.level >= (SUBSKILL_GATES[Number(field.at(-1))] ?? Infinity)
    if (field.startsWith('ingredient')) return mode === 'ingredients' && pokemon.level >= ([1, 30, 60][Number(field.at(-1))] ?? Infinity)
    return false
  })
}
function finiteClamp(value: number, min: number, max: number) { return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min }
/** Independent 24-hour production, retaining only the individual's own unlocked bonuses. */
export function calculateBoxOverview(pokemon: readonly BoxPokemon[], bonuses: OverviewBonuses = defaultOverviewBonuses()) {
  const settings = { ...defaultSettings(), island: bonuses.island ?? 'greengrass', exBuff: bonuses.exBuff ?? true, exDebuff: bonuses.exDebuff ?? true, exWeeklyBonus: bonuses.exWeeklyBonus ?? 'none', berries: bonuses.favoredBerries, areaBonus: finiteClamp(bonuses.areaBonus, 0, 0.85), goodCamp: bonuses.goodCamp }
  const externalBonus = Math.floor(finiteClamp(bonuses.helpingBonus, 0, 5))
  const berryRanks = new Map<string, OverviewRank[]>(), ingredientRanks = new Map<string, OverviewRank[]>()
  const excludedBerries: BoxPokemon[] = [], excludedIngredients: BoxPokemon[] = []
  for (const member of pokemon) {
    if (!pokeById(member.pokeId)) { excludedBerries.push(member); excludedIngredients.push(member); continue }
    const ownBonus = unlockedSubskills(member.level, member.subskills).includes('helpingBonus') ? 1 : 0
    const bonus = Math.min(5, externalBonus + ownBonus)
    const input = { ...member, wakeEnergy: 100, ribbonHours: member.tune?.ribbonHours ?? 0 }
    if (criticalOverviewFields(member, 'berries').length) excludedBerries.push(member)
    else {
      const berry = pokeById(member.pokeId)!.berry
      const list = berryRanks.get(berry) ?? []
      list.push({ pokemon: member, amount: produce(settings, { ...input, carryMode: 'full' }, bonus).berryEnergy })
      berryRanks.set(berry, list)
    }
    if (criticalOverviewFields(member, 'ingredients').length) excludedIngredients.push(member)
    else {
      const output = produce(settings, { ...input, carryMode: 'unlimited' }, bonus)
      for (const [name, amount] of Object.entries(output.ingredients)) {
        if (amount <= 0) continue
        const list = ingredientRanks.get(name) ?? []
        list.push({ pokemon: member, amount })
        ingredientRanks.set(name, list)
      }
    }
  }
  const sort = (rows: OverviewRank[]) => rows.sort((a, b) => b.amount - a.amount || a.pokemon.uid.localeCompare(b.pokemon.uid))
  return {
    berries: BERRIES.map((berry) => ({ ...berry, rows: sort(berryRanks.get(berry.name) ?? []).slice(0, 3) })),
    ingredients: INGREDIENTS.map((ingredient) => ({ ...ingredient, rows: sort(ingredientRanks.get(ingredient.name) ?? []) })),
    excludedBerries, excludedIngredients,
  }
}
