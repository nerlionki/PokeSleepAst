import extracted0 from '../data/client-defaults.json'
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

export function bonusLabel(bonus: number): string {
  const pct = Math.round(bonus * 100)
  return `+${pct}%（${(1 + bonus).toFixed(2)}x）`
}
