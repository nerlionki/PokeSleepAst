import meta from '../data/meta.resource';

export interface AnnouncedIngredient {
  imageFile?: string;
  key: string;
  name: string;
  runtimeId: number | null;
  imageId?: number;
  baseEnergy: number | null;
}
export interface AnnouncedPokemon {
  availableFrom?: string;
  timeBasis?: string;
  nationalDex?: number;
  imageId?: number;
  name: string;
  runtimeId: number | null;
  type: string;
  sleepType: string;
  berry?: string | null;
  carry?: number | null;
  friendship?: number | null;
  medalGroup?: number | null;
  islands?: string[];
  canGatherIngredientKey?: string;

}
export interface AnnouncedRecipe {
  imageFile?: string;
  imageId?: number;
  baseEnergy: number | null;
  /** 与既有食谱详情相同的等级：1、10、20、30、40、50、60、70。 */
  levelEnergy?: Record<string, number>;
  bonus?: number | null;
  ingredientQuantities: Record<string, number> | null;
  key: string;
  name: string | null;
  runtimeId: number | null;
  category: string;
  totalIngredientCount: number;
  ingredients: string[];
}
export interface AnnouncedActivity {
  activityId: string;
  effects: {
    availableRecipeCategories?: string[];
    ingredientSpecialists?: {
      specialty: string;
      fixedIngredientDrop?: { ingredientKey: string; quantity: number };
      carryCapacityBonus?: number;
    };
    potCapacityBonus?: number;
    cooking?: {
      recipeRequiredPortion: {
        requiredIngredientKey: string;
        energyMultiplier: number;
      };
      extraIngredients: { ingredientKey: string; energyMultiplier: number }[];
    };
  };
}
interface Announcements {
  schemaVersion: number;
  ingredients: AnnouncedIngredient[];
  pokemon: AnnouncedPokemon[];
  recipes: AnnouncedRecipe[];
  activities?: AnnouncedActivity[];
}
// Additive 1.0.11 metadata: old clients keep their existing activities contract.
// Resolve once from the installed snapshot, just like the other resource adapters.
const content = (meta as unknown as { announcedContent?: Announcements })
  .announcedContent;
// Image IDs are declared by the resource; names never infer Pokemon/ingredient artwork.
export const ANNOUNCED =
  content?.schemaVersion === 1
    ? {
        ...content,
        ingredients: content.ingredients.map(row => ({ ...row })),
        pokemon: content.pokemon.map(row => ({ ...row }))
      }
    : { ingredients: [], pokemon: [], recipes: [], activities: [] };
export const NUT = ANNOUNCED.ingredients.find(
  row => row.key === 'bite-size-nut'
);
export const NUT_NAME = NUT?.name ?? '一口坚果';
