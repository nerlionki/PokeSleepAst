import extracted0 from '../data/client-defaults.resource'
import { cloneData } from './dataClone'
import { RECIPE_LEVEL_MAX, recipeLevelMult } from './cook'
import { RECIPES } from './data'
const recipes_config_extracted0 = extracted0.modules.recipes


export type RecipeRow = (typeof RECIPES)[number]

export const MEAL_CATEGORIES = (cloneData(recipes_config_extracted0.MEAL_CATEGORIES) as unknown as readonly [{readonly "id":"curry";readonly "label":"咖喱、浓汤"},{readonly "id":"salad";readonly "label":"沙拉"},{readonly "id":"dessert";readonly "label":"点心、饮料"}])

export const RECIPE_LEVELS = ([...cloneData(recipes_config_extracted0.RECIPE_LEVELS), RECIPE_LEVEL_MAX] as readonly number[])

export function dishEnergy(baseEnergy: number, level: number): number {
  return Math.round(baseEnergy * recipeLevelMult(level))
}

/** Display order uses base energy so editing recipe levels never reorders a list. */
export function compareRecipeEnergyDescending(
  a: Pick<RecipeRow, 'pot' | 'name'> & { baseEnergy: number | null },
  b: Pick<RecipeRow, 'pot' | 'name'> & { baseEnergy: number | null },
): number {
  return (b.baseEnergy ?? -1) - (a.baseEnergy ?? -1)
    || a.pot - b.pot || a.name.localeCompare(b.name, 'zh-CN')
}

const strongestIngredientRecipes = new Map<string, { recipe: RecipeRow; dailyNeed: number }>()
for (const recipe of RECIPES.filter(row => !row.mix && row.baseEnergy > 0).sort(compareRecipeEnergyDescending)) {
  for (const ingredient of recipe.ingredients) {
    const key = String(ingredient.id)
    if (ingredient.count > 0 && !strongestIngredientRecipes.has(key)) {
      strongestIngredientRecipes.set(key, { recipe, dailyNeed: ingredient.count * 3 })
    }
  }
}

/** Read production in its current period and compare its daily average with three servings. */
export function ingredientRecipeCoverage(ingredientKey: string, amount: number | undefined, period: 'day' | 'week' = 'day') {
  const target = strongestIngredientRecipes.get(ingredientKey)
  if (!target || amount == null || !Number.isFinite(amount) || amount < 0) return undefined
  const days = period === 'week' ? 7 : 1
  return { ...target, percent: amount / days / target.dailyNeed * 100 }
}

export function bonusLabel(bonus: number): string {
  const pct = Math.round(bonus * 100)
  return `+${pct}%（${(1 + bonus).toFixed(2)}x）`
}
