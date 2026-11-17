import { RECIPES } from './data';
import { ANNOUNCED } from './announcedContent';
import { ingredientImageId, ingredientKey } from './catalogIds';
import type { RecipeRow } from './recipes';

/** Nullable display records never enter the numeric cooking catalog. */
export type RecipeDisplayRow = Omit<
  RecipeRow,
  'baseEnergy' | 'bonus' | 'ingredients'
> & {
  baseEnergy: number | null;
  bonus: number | null;
  nameUnannounced?: boolean;
  announcementKey?: string;
  imageFile?: string;
  ingredients: { id: number; name: string; count: number | null; filterKey?: string }[];
};

export function recipeDisplayLevelKey(recipe: RecipeDisplayRow): number | null {
  return recipe.id > 0 ? recipe.id : null;
}
const categoryIds: Record<string, string> = {
  咖喱: 'curry',
  沙拉: 'salad',
  甜品: 'dessert'
};
export const RECIPE_CATALOG: RecipeDisplayRow[] = [
  ...RECIPES,
  ...ANNOUNCED.recipes
    .filter(row => !RECIPES.some(known => known.id === row.imageId || known.name === row.name))
    .map(row => ({
      id: row.imageId ?? 0,
      announcementKey: row.key,
      name: row.name ?? `新${row.category}食谱`,
      nameUnannounced: row.name == null,
      imageFile: row.imageFile,
      category: categoryIds[row.category] ?? row.category,
      pot: row.totalIngredientCount,
      baseEnergy: row.baseEnergy,
      bonus: typeof row.bonus === 'number' ? row.bonus : null,
      mix: false,
      ingredients: row.ingredients.map(name => {
        const filterKey = ingredientKey(name);
        return {
          id: filterKey ? ingredientImageId(filterKey) : 0,
          filterKey,
          name,
          count: row.ingredientQuantities?.[name] ?? null
        };
      })
    }))
];
