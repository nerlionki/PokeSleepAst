import { RECIPE_LEVEL_MAX, recipeLevelMult } from './cook'
import { RECIPES } from './data'

export type RecipeRow = (typeof RECIPES)[number]

export const MEAL_CATEGORIES = [
  { id: 'curry', label: '咖喱、浓汤' },
  { id: 'salad', label: '沙拉' },
  { id: 'dessert', label: '点心、饮料' },
] as const

export const RECIPE_LEVELS = [1, 10, 20, 30, 40, 50, 60, RECIPE_LEVEL_MAX] as const

export function dishEnergy(baseEnergy: number, level: number): number {
  return Math.round(baseEnergy * recipeLevelMult(level))
}

export function bonusLabel(bonus: number): string {
  const pct = Math.round(bonus * 100)
  return `+${pct}%（${(1 + bonus).toFixed(2)}x）`
}
