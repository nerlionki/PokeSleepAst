import { ANNOUNCED } from './announcedContent'
import { INGREDIENTS, RECIPES } from './data'
import { foldText } from './text'

const ingredients = new Map(INGREDIENTS.map(row => [String(row.id), row]))
const recipes = new Map(RECIPES.map(row => [String(row.id), row]))
const announced = new Map(ANNOUNCED.ingredients.map(row => [`announced:${row.key}`, row]))
const ingredientNames = new Map([
  ...[...announced].map(([key, row]) => [foldText(row.name), key] as const),
  ...INGREDIENTS.map(row => [foldText(row.name), String(row.id)] as const),
])
const recipeNames = new Map(RECIPES.map(row => [foldText(row.name), String(row.id)]))

// JSON inventory keys are decimal strings. Unpublished ingredients use their
// announcement key until the resource provides a catalog ID and energy.
export function ingredientKey(value: string): string | undefined {
  if (ingredients.has(value)) return value
  const announcement = announced.get(value)
  if (announcement) return ingredientNames.get(foldText(announcement.name)) ?? value
  return ingredientNames.get(foldText(value))
}
export function ingredientRow(key: string) { return ingredients.get(key) }
export function ingredientLabel(key: string): string {
  return ingredients.get(key)?.name ?? announced.get(key)?.name ?? key
}
export function ingredientImageId(key: string): number {
  return ingredients.get(key)?.id ?? announced.get(key)?.imageId ?? 0
}
export function recipeKey(value: string): string | undefined {
  return recipes.has(value) ? value : recipeNames.get(foldText(value))
}
export function recipeById(id: number | null | undefined) { return id == null ? undefined : recipes.get(String(id)) }

const announcedRecipeImageIds = new Set(ANNOUNCED.recipes.map(row => row.imageId).filter(id => id != null && id > 0))

/** Preserve the same preference ID before and after the recipe enters the cooking catalog. */
export function recipeLevelKey(value: string): string | undefined {
  const id = /^announced-image:([1-9]\d*)$/.exec(value)?.[1] ?? value
  if (/^[1-9]\d*$/.test(id) && announcedRecipeImageIds.has(Number(id))) return id
  return recipeKey(id)
}

export function migrateCatalogCounts(values: Readonly<Record<string, number>>, resolve: (key: string) => string | undefined, previous?: Readonly<Record<string, number>>) {
  const counts: Record<string, number> = {}
  const unresolved: Record<string, number> = Object.create(null)
  const entries = Object.entries(values)
  // Reserve explicit IDs first. Keep the losing value when a legacy entry conflicts.
  for (const [key, value] of entries) if (resolve(key) === key) counts[key] = value
  for (const [key, value] of entries) {
    const id = resolve(key)
    if (id === key) continue
    if (!id || Object.hasOwn(counts, id)) {
      if (!id || counts[id] !== value) unresolved[key] = value
    } else counts[id] = value
  }
  for (const [key, value] of Object.entries(previous ?? {})) {
    if (Object.hasOwn(unresolved, key)) continue
    const id = resolve(key)
    if (id && !Object.hasOwn(counts, id)) counts[id] = value
    else if (!id || counts[id] !== value) unresolved[key] = value
  }
  return { counts, unresolved }
}

export function addIngredient(target: Record<string, number>, key: string | number, amount: number) {
  target[key] = (target[key] ?? 0) + amount
}
