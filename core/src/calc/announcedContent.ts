import { foldText } from './text'
import meta from '../data/meta.resource'

export interface AnnouncedIngredient { imageFile?: string; key: string; name: string; runtimeId: number | null; imageId?: number; baseEnergy: number | null }
export interface AnnouncedPokemon { nationalDex?: number; imageId?: number; name: string; runtimeId: number | null; type: string; sleepType: string }
export interface AnnouncedRecipe { imageFile?: string; baseEnergy: number | null; ingredientQuantities: Record<string, number> | null; key: string; name: string | null; runtimeId: number | null; category: string; totalIngredientCount: number; ingredients: string[] }
export interface AnnouncedActivity {
  activityId: string; effects: {
    availableRecipeCategories?: string[];
    ingredientSpecialists?: { specialty: string; fixedIngredientDrop?: { ingredientKey: string; quantity: number }; carryCapacityBonus?: number };
    potCapacityBonus?: number;
    cooking?: { recipeRequiredPortion: { requiredIngredientKey: string; energyMultiplier: number }; extraIngredients: { ingredientKey: string; energyMultiplier: number }[] };
  }
}
interface Announcements { schemaVersion: number; ingredients: AnnouncedIngredient[]; pokemon: AnnouncedPokemon[]; recipes: AnnouncedRecipe[]; activities?: AnnouncedActivity[] }
// Additive 1.0.11 metadata: old clients keep their existing activities contract.
// Resolve once from the installed snapshot, just like the other resource adapters.
const content = (meta as unknown as { announcedContent?: Announcements }).announcedContent
// Placeholder image IDs are display assets, never production/runtime IDs.
// The already published 1.0.11 metadata predates imageId; keep it usable too.
const officialPlaceholderImages: Record<string, number> = { 木棉球: 546, 风妖精: 547 }
export const ANNOUNCED = content?.schemaVersion === 1 ? {
  ...content,
  ingredients: content.ingredients.map(row => ({ ...row, imageId: row.imageId ?? (row.key === 'bite-size-nut' ? 0 : undefined) })),
  pokemon: content.pokemon.map(row => ({ ...row, nationalDex: row.nationalDex ?? Object.entries(officialPlaceholderImages).find(([name]) => foldText(name) === foldText(row.name))?.[1], imageId: row.imageId ?? Object.entries(officialPlaceholderImages).find(([name]) => foldText(name) === foldText(row.name))?.[1] })),
} : { ingredients: [], pokemon: [], recipes: [], activities: [] }
export const NUT = ANNOUNCED.ingredients.find(row => row.key === 'bite-size-nut')
export const NUT_NAME = NUT?.name ?? '一口坚果'
