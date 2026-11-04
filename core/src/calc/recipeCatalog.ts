import { RECIPES } from './data'
import { ANNOUNCED } from './announcedContent'
import { INGREDIENT_CATALOG } from './ingredientCatalog'
import type { RecipeRow } from './recipes'

/** Nullable display records never enter the numeric cooking catalog. */
export type RecipeDisplayRow = Omit<RecipeRow, 'baseEnergy' | 'bonus' | 'ingredients'> & {
  baseEnergy: number | null
  bonus: number | null
  nameUnannounced?: boolean
  imageFile?: string
  ingredients: { id: number; name: string; count: number | null }[]
}
const categoryIds: Record<string, string> = { 咖喱: 'curry', 沙拉: 'salad', 甜品: 'dessert' }
export const RECIPE_CATALOG: RecipeDisplayRow[] = [
  ...RECIPES,
  ...ANNOUNCED.recipes.filter(row => !RECIPES.some(known => known.name === row.name)).map(row => ({
    name: row.name ?? `新${row.category}食谱`,
    nameUnannounced: row.name == null,
    imageFile: row.imageFile,
    category: categoryIds[row.category] ?? row.category,
    pot: row.totalIngredientCount,
    baseEnergy: row.baseEnergy,
    bonus: null,
    mix: false,
    ingredients: row.ingredients.map(name => ({
      id: INGREDIENT_CATALOG.find(ingredient => ingredient.name === name)?.imageId ?? 0,
      name,
      count: row.ingredientQuantities?.[name] ?? null,
    })),
  })),
]
