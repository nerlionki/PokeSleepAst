import { NUT_NAME } from './announcedContent'
import { validateActivityEffects, type ActivityOverrides } from '../resources/activityModel'

/** One-way migration of saved pre-v2 manual settings. New rules never use these keys. */
export function normalizeActivityOverrides(input: unknown): ActivityOverrides {
  if (!input || typeof input !== 'object' || Array.isArray(input)) { validateActivityEffects(input); return input }
  const value = { ...input } as Record<string, unknown>
  const fixed = value.fixedNutBonus
  const required = value.nutRecipeEnergyMultiplier
  const extra = value.extraNutEnergyMultiplier
  delete value.fixedNutBonus; delete value.nutRecipeEnergyMultiplier; delete value.extraNutEnergyMultiplier
  if (fixed != null) value.fixedIngredientDrops = { [NUT_NAME]: fixed, ...(value.fixedIngredientDrops as object ?? {}) }
  if (extra != null) value.extraIngredientEnergyMultipliers = { [NUT_NAME]: extra, ...(value.extraIngredientEnergyMultipliers as object ?? {}) }
  if (required != null) value.recipeEnergyModifiers = [
    { id: 'legacy-required-portion', ingredientNames: [NUT_NAME], multiplier: required },
    ...(Array.isArray(value.recipeEnergyModifiers) ? value.recipeEnergyModifiers : []),
  ]
  validateActivityEffects(value)
  return value
}
