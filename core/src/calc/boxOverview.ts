import ruleCatalogs from '../data/rule-catalogs.resource'
import ruleParameters from '../data/rule-parameters.resource'
import clientFactoryDefaults from '../data/client-defaults.resource'
import { cloneData } from './dataClone'
import type { BoxPokemon, OcrMissingField, IslandId, Settings } from '../types'
import { BERRIES, INGREDIENTS, pokeById } from './data'
import { defaultSettings } from './defaults'
import { SUBSKILL_GATES, unlockedSubskills } from './member'
import { normalizeOcrMissing } from './ocrCompletion'
import { produce } from './produce'
const factory_boxOverview_config_clientFactoryDefaults = clientFactoryDefaults.modules.factory_boxOverview
const boxOverview_config_ruleCatalogs = ruleCatalogs.modules.boxOverview
const boxOverview_calculateBoxOverview_ruleParameters = ruleParameters.modules.boxOverview.calculateBoxOverview


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
export const defaultOverviewBonuses = (): OverviewBonuses => ((cloneData(factory_boxOverview_config_clientFactoryDefaults["defaultOverviewBonuses"]) as unknown as OverviewBonuses))
export interface OverviewRank { pokemon: BoxPokemon; amount: number }
/** Mini Program engines may ignore toLocaleString fraction options. */
export function formatOverviewAmount(amount: number | undefined, places = 2): string {
  if (amount == null || !Number.isFinite(amount) || amount < 0) return '—'
  const [whole, fraction] = amount.toFixed(places).split('.')
  return whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (fraction == null ? '' : `.${fraction}`)
}
export function criticalOverviewFields(pokemon: BoxPokemon, mode: 'berries' | 'ingredients'): OcrMissingField[] {
  return normalizeOcrMissing(pokemon.ocrMissing).filter((field) => {
    if (field === 'level' || field === 'nature' || field === 'skillLevel') return true
    if (field.startsWith('subskill')) return pokemon.level >= (SUBSKILL_GATES[Number(field.at(-1))] ?? Infinity)
    if (field.startsWith('ingredient')) return mode === 'ingredients' && pokemon.level >= (boxOverview_config_ruleCatalogs.criticalOverviewFieldsList0.values[Number(field.at(-1))] ?? Infinity)
    return false
  })
}
function finiteClamp(value: number, min: number, max: number) { return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min }
/** Independent 24-hour production, retaining only the individual's own unlocked bonuses. */
export function calculateBoxOverview(pokemon: readonly BoxPokemon[], bonuses: OverviewBonuses = defaultOverviewBonuses()) {
  const settings = { ...defaultSettings(), island: bonuses.island ?? 'greengrass', exBuff: bonuses.exBuff ?? true, exDebuff: bonuses.exDebuff ?? true, exWeeklyBonus: bonuses.exWeeklyBonus ?? 'none', berries: bonuses.favoredBerries, areaBonus: finiteClamp(bonuses.areaBonus, 0, boxOverview_calculateBoxOverview_ruleParameters.areaBonusCap), goodCamp: bonuses.goodCamp }
  const externalBonus = Math.floor(finiteClamp(bonuses.helpingBonus, 0, boxOverview_calculateBoxOverview_ruleParameters.helpingBonusCap))
  const berryRanks = new Map<string, OverviewRank[]>(), ingredientRanks = new Map<string, OverviewRank[]>()
  const excludedBerries: BoxPokemon[] = [], excludedIngredients: BoxPokemon[] = []
  for (const member of pokemon) {
    if (!pokeById(member.pokeId)) { excludedBerries.push(member); excludedIngredients.push(member); continue }
    const ownBonus = unlockedSubskills(member.level, member.subskills).includes('helpingBonus') ? 1 : 0
    const bonus = Math.min(boxOverview_calculateBoxOverview_ruleParameters.helpingBonusCap, externalBonus + ownBonus)
    const input = { ...member, wakeEnergy: boxOverview_calculateBoxOverview_ruleParameters.fixedComparisonEnergy, ribbonHours: member.tune?.ribbonHours ?? 0 }
    const missingBerries = criticalOverviewFields(member, 'berries').length > 0
    const missingIngredients = criticalOverviewFields(member, 'ingredients').length > 0
    const output = missingBerries && missingIngredients ? undefined : produce(settings, { ...input, carryMode: 'unlimited' }, bonus)
    if (criticalOverviewFields(member, 'berries').length) excludedBerries.push(member)
    else {
      const berry = pokeById(member.pokeId)!.berry
      const list = berryRanks.get(berry) ?? []
      list.push({ pokemon: member, amount: output!.berryEnergy })
      berryRanks.set(berry, list)
    }
    if (criticalOverviewFields(member, 'ingredients').length) excludedIngredients.push(member)
    else {
      for (const [name, total] of Object.entries(output!.ingredients)) {
        // produce includes direct skill food and extra-help food; this panel ranks ordinary helps only.
        const amount = total - (output!.skillIngredients?.[name] ?? 0)
        if (!Number.isFinite(amount) || amount <= 0) continue
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
