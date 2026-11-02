import ruleParameters from '../data/rule-parameters.resource'
import extracted0 from '../data/calc-tables.resource'
import { cloneData } from './dataClone'
import type { CookMeal, MealCategory, Settings } from '../types'
import { INGREDIENTS, RECIPES } from './data'
import { activityValues, createActivityContext } from './activities'
const cook_config_extracted0 = extracted0.modules.cook
const cook_cookEnergy_ruleParameters = ruleParameters.modules.cook.cookEnergy
const cook_cookingContext_ruleParameters = ruleParameters.modules.cook.cookingContext
const cook_cookMealWithContext_ruleParameters = ruleParameters.modules.cook.cookMealWithContext
const cook_cookMeals_ruleParameters = ruleParameters.modules.cook.cookMeals


export const RECIPE_LEVEL_MAX = (cook_config_extracted0.RECIPE_LEVEL_MAX as 70)
/** 真实等级加成，来源：https://wikiwiki.jp/poke_sleep/料理 */
const LEVEL_BONUS = cloneData(cook_config_extracted0.LEVEL_BONUS)

export function recipeLevelOf(settings: CookSettings, name: string): number {
  return Math.min(RECIPE_LEVEL_MAX, Math.max(1, settings.recipeLevels?.[name] || 1))
}

export function recipeLevelMult(level: number): number {
  const lv = Math.min(RECIPE_LEVEL_MAX, Math.max(1, Math.floor(level) || 1))
  return 1 + LEVEL_BONUS[lv - 1]! / 100
}

export function cookEnergy(recipeName: string, extra: number, sunday: boolean, recipeLevel = 1): number {
  const recipe = RECIPES.find((r) => r.name === recipeName)
  if (!recipe) return 0
  const extraEnergy = extra * cook_cookEnergy_ruleParameters.unknownIngredientEnergy
  const raw = recipe.baseEnergy * recipeLevelMult(recipeLevel) + extraEnergy
  const crit = sunday ? cook_cookEnergy_ruleParameters.sundayCritChance * cook_cookEnergy_ruleParameters.sundayCritMultiplier + cook_cookEnergy_ruleParameters.sundayNormalChance : cook_cookEnergy_ruleParameters.normalCritChance * cook_cookEnergy_ruleParameters.normalCritMultiplier + cook_cookEnergy_ruleParameters.normalChance
  return Math.round(raw * crit)
}

export type CookSettings = Readonly<Pick<Settings, 'goodCamp' | 'sundayPot' | 'potSize' | 'mealCategory' | 'areaBonus' | 'recipeLevels'> & Partial<Pick<Settings, 'activity' | 'island'>>>
export type IngredientBag = Readonly<Record<string, number>>
export interface CookOptions { pot?: number, multiplier?: number }
export interface CookResult { meals: CookMeal[], remain: Record<string, number> }
export interface IngredientAllocation { remain: Record<string, number>, used: number, energy: number }

const ingredientEnergy = new Map(INGREDIENTS.map(ingredient => [ingredient.name, ingredient.energy]))

/** Allocate filler ingredients by energy without changing the caller's inventory.
 * Unknown ingredients retain the existing branch-specific energy fallback. */
export function allocateIngredients(bag: IngredientBag, capacity: number, unknownEnergy = 0): IngredientAllocation {
  const names = Object.keys(bag).sort((a, b) => (ingredientEnergy.get(b) ?? 0) - (ingredientEnergy.get(a) ?? 0))
  return names.reduce<IngredientAllocation>((state, name) => {
    const take = Math.min(Math.floor(state.remain[name] ?? 0), capacity - state.used)
    if (take <= 0) return state
    return {
      remain: { ...state.remain, [name]: (state.remain[name] ?? 0) - take },
      used: state.used + take,
      energy: state.energy + take * (ingredientEnergy.get(name) ?? unknownEnergy),
    }
  }, { remain: { ...bag }, used: 0, energy: 0 })
}

function cookingContext(settings: CookSettings, sunday: boolean, options: CookOptions) {
  const activity = activityValues(createActivityContext('research', settings.activity), settings.island ?? '')
  const potMul = (settings.goodCamp ? cook_cookingContext_ruleParameters.campPotMultiplier : 1) * (sunday || settings.sundayPot ? cook_cookingContext_ruleParameters.sundayPotMultiplier : 1)
  const pot = options.pot ?? Math.ceil(settings.potSize * potMul * activity.potSizeMultiplier)
  const pool = RECIPES.filter(recipe => recipe.category === settings.mealCategory && !recipe.mix)
    .sort((a, b) => b.baseEnergy * recipeLevelMult(recipeLevelOf(settings, b.name)) - a.baseEnergy * recipeLevelMult(recipeLevelOf(settings, a.name)))
  const mix = RECIPES.find(recipe => recipe.category === settings.mealCategory && recipe.mix)
  const chance = Math.min(1, (sunday ? cook_cookingContext_ruleParameters.sundayCritChance : cook_cookingContext_ruleParameters.normalCritChance) + activity.cookingCritBonus)
  return { pot, pool, mix, settings, multiplier: options.multiplier ?? (1 + chance * ((sunday ? cook_cookingContext_ruleParameters.sundayCritMultiplier : cook_cookingContext_ruleParameters.normalCritMultiplier) * activity.cookingCritMultiplier - 1)) * activity.cookingEnergyMultiplier }
}

function cookMealWithContext(bag: IngredientBag, context: ReturnType<typeof cookingContext>): { meal: CookMeal, remain: Record<string, number> } {
  const { pot, pool, mix, settings, multiplier } = context
  const hit = pool.find(recipe => recipe.pot <= pot && recipe.ingredients.every(ingredient => (bag[ingredient.name] ?? 0) >= ingredient.count))
  const baseBag = hit ? hit.ingredients.reduce<Record<string, number>>((remain, ingredient) => ({
    ...remain, [ingredient.name]: (remain[ingredient.name] ?? 0) - ingredient.count,
  }), { ...bag }) : bag
  const allocation = allocateIngredients(baseBag, hit ? Math.max(0, pot - hit.pot) : pot, hit ? 0 : cook_cookMealWithContext_ruleParameters.unknownIngredientEnergy)
  const baseEnergy = hit ? hit.baseEnergy * recipeLevelMult(recipeLevelOf(settings, hit.name)) : 0
  return {
    meal: {
      name: hit?.name ?? mix?.name ?? '拌拌',
      mix: !hit,
      potUsed: (hit?.pot ?? 0) + allocation.used,
      energy: hit
        ? Math.round((baseEnergy + allocation.energy) * (1 + settings.areaBonus) * multiplier)
        : Math.round(allocation.energy * multiplier * (1 + settings.areaBonus)),
    },
    remain: allocation.remain,
  }
}

/** Calculate one meal as an inventory transition, independently of stores or platforms. */
export function cookMeal(bag: IngredientBag, settings: CookSettings, sunday = false, options: CookOptions = {}): { meal: CookMeal, remain: Record<string, number> } {
  return cookMealWithContext(bag, cookingContext(settings, sunday, options))
}

export function cookMeals(bag: IngredientBag, settings: CookSettings, meals = cook_cookMeals_ruleParameters.defaultMeals, sunday = false, options: CookOptions = {}): CookResult {
  // Keep the original NaN/fraction/infinity iteration behavior.
  const count = Math.min(cook_cookMeals_ruleParameters.weeklyMealLimit, Math.max(0, Math.floor(meals)))
  const context = cookingContext(settings, sunday, options)
  return Array.from({ length: count }).reduce<CookResult>(state => {
    const next = cookMealWithContext(state.remain, context)
    return { meals: [...state.meals, next.meal], remain: next.remain }
  }, { meals: [], remain: { ...bag } })
}

export function categoryLabel(c: MealCategory): string {
  if (c === 'curry') return '咖哩濃湯'
  if (c === 'salad') return '沙拉'
  return '点心饮料'
}
