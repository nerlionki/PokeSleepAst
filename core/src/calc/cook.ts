import type { CookMeal, MealCategory, Settings } from '../types'
import { INGREDIENTS, RECIPES } from './data'

export const RECIPE_LEVEL_MAX = 70
/** 真实等级加成，来源：https://wikiwiki.jp/poke_sleep/料理 */
const LEVEL_BONUS = [0,2,4,6,8,9,11,13,16,18,19,21,23,24,26,28,30,31,33,35,37,40,42,45,47,50,52,55,58,61,64,67,70,74,77,81,84,88,92,96,100,104,108,113,117,122,127,132,137,142,148,153,159,165,171,177,183,190,197,203,209,215,221,227,234,239,243,248,252,258]

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
  const extraEnergy = extra * 30
  const raw = recipe.baseEnergy * recipeLevelMult(recipeLevel) + extraEnergy
  const crit = sunday ? 0.3 * 3 + 0.7 : 0.1 * 2 + 0.9
  return Math.round(raw * crit)
}

export type CookSettings = Readonly<Pick<Settings, 'goodCamp' | 'sundayPot' | 'potSize' | 'mealCategory' | 'areaBonus' | 'recipeLevels'>>
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
  const potMul = (settings.goodCamp ? 1.5 : 1) * (sunday || settings.sundayPot ? 2 : 1)
  const pot = options.pot ?? Math.ceil(settings.potSize * potMul)
  const pool = RECIPES.filter(recipe => recipe.category === settings.mealCategory && !recipe.mix)
    .sort((a, b) => b.baseEnergy * recipeLevelMult(recipeLevelOf(settings, b.name)) - a.baseEnergy * recipeLevelMult(recipeLevelOf(settings, a.name)))
  const mix = RECIPES.find(recipe => recipe.category === settings.mealCategory && recipe.mix)
  return { pot, pool, mix, settings, multiplier: options.multiplier ?? (sunday ? 1.6 : 1.1) }
}

function cookMealWithContext(bag: IngredientBag, context: ReturnType<typeof cookingContext>): { meal: CookMeal, remain: Record<string, number> } {
  const { pot, pool, mix, settings, multiplier } = context
  const hit = pool.find(recipe => recipe.pot <= pot && recipe.ingredients.every(ingredient => (bag[ingredient.name] ?? 0) >= ingredient.count))
  const baseBag = hit ? hit.ingredients.reduce<Record<string, number>>((remain, ingredient) => ({
    ...remain, [ingredient.name]: (remain[ingredient.name] ?? 0) - ingredient.count,
  }), { ...bag }) : bag
  const allocation = allocateIngredients(baseBag, hit ? Math.max(0, pot - hit.pot) : pot, hit ? 0 : 30)
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

export function cookMeals(bag: IngredientBag, settings: CookSettings, meals = 3, sunday = false, options: CookOptions = {}): CookResult {
  // Keep the original NaN/fraction/infinity iteration behavior.
  const count = Math.min(21, Math.max(0, Math.floor(meals)))
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
