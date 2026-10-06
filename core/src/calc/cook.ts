import type { CookMeal, MealCategory, Settings } from '../types'
import { INGREDIENTS, RECIPES } from './data'

export const RECIPE_LEVEL_MAX = 70

export function recipeLevelOf(settings: Settings, name: string): number {
  return Math.min(RECIPE_LEVEL_MAX, Math.max(1, settings.recipeLevels?.[name] || 1))
}

export function recipeLevelMult(level: number): number {
  const lv = Math.min(RECIPE_LEVEL_MAX, Math.max(1, level || 1))
  return 1 + (lv - 1) * 0.02
}

export function cookEnergy(recipeName: string, extra: number, sunday: boolean, recipeLevel = 1): number {
  const recipe = RECIPES.find((r) => r.name === recipeName)
  if (!recipe) return 0
  let ingEnergy = 0
  for (const ing of recipe.ingredients) {
    const meta = INGREDIENTS.find((i) => i.id === ing.id)
    ingEnergy += (meta?.energy ?? 0) * ing.count
  }
  const extraEnergy = extra * 30
  const raw = (ingEnergy * (1 + recipe.bonus) + extraEnergy) * recipeLevelMult(recipeLevel)
  const crit = sunday ? 0.3 * 3 + 0.7 : 0.1 * 2 + 0.9
  return Math.round(raw * crit)
}

export function cookMeals(bag: Record<string, number>, settings: Settings, meals = 3, sunday = false): { meals: CookMeal[], remain: Record<string, number> } {
  const potMul = (settings.goodCamp ? 1.5 : 1) * (sunday || settings.sundayPot ? 2 : 1)
  const pot = Math.round(settings.potSize * potMul)
  const pool = RECIPES.filter((r) => r.category === settings.mealCategory && !r.mix)
    .slice()
    .sort((a, b) => b.baseEnergy - a.baseEnergy)
  const remain = { ...bag }
  const out: CookMeal[] = []
  const mix = RECIPES.find((r) => r.category === settings.mealCategory && r.mix)

  for (let i = 0; i < meals; i++) {
    const hit = pool.find((r) => {
      if (r.pot > pot) return false
      return r.ingredients.every((ing) => (remain[ing.name] ?? 0) >= ing.count)
    })
    if (hit) {
      for (const ing of hit.ingredients) remain[ing.name] = (remain[ing.name] ?? 0) - ing.count
      let extra = 0
      const room = pot - hit.pot
      if (room > 0) {
        for (const name of Object.keys(remain)) {
          const take = Math.min(remain[name], room - extra)
          if (take <= 0) continue
          remain[name] -= take
          extra += take
          if (extra >= room) break
        }
      }
      out.push({ name: hit.name, mix: false, potUsed: hit.pot + extra, energy: cookEnergy(hit.name, extra, sunday, recipeLevelOf(settings, hit.name)) })
    }
    else {
      let used = 0
      let fill = 0
      for (const name of Object.keys(remain)) {
        const take = Math.min(remain[name], pot - used)
        if (take <= 0) continue
        remain[name] -= take
        used += take
        fill += take * (INGREDIENTS.find((x) => x.name === name)?.energy ?? 30)
      }
      const crit = sunday ? 1.6 : 1.1
      out.push({
        name: mix?.name ?? '拌拌',
        mix: true,
        potUsed: used,
        energy: Math.round(fill * crit * recipeLevelMult(recipeLevelOf(settings, mix?.name ?? ''))),
      })
    }
  }
  return { meals: out, remain }
}

export function categoryLabel(c: MealCategory): string {
  if (c === 'curry') return '咖哩濃湯'
  if (c === 'salad') return '沙拉'
  return '点心饮料'
}
