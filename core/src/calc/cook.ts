import type { CookMeal, MealCategory, Settings } from '../types'
import { INGREDIENTS, RECIPES } from './data'

export const RECIPE_LEVEL_MAX = 70
/** 真实等级加成，来源：https://wikiwiki.jp/poke_sleep/料理 */
const LEVEL_BONUS = [0,2,4,6,8,9,11,13,16,18,19,21,23,24,26,28,30,31,33,35,37,40,42,45,47,50,52,55,58,61,64,67,70,74,77,81,84,88,92,96,100,104,108,113,117,122,127,132,137,142,148,153,159,165,171,177,183,190,197,203,209,215,221,227,234,239,243,248,252,258]

export function recipeLevelOf(settings: Settings, name: string): number {
  return Math.min(RECIPE_LEVEL_MAX, Math.max(1, settings.recipeLevels?.[name] || 1))
}

export function recipeLevelMult(level: number): number {
  const lv = Math.min(RECIPE_LEVEL_MAX, Math.max(1, Math.floor(level) || 1))
  return 1 + LEVEL_BONUS[lv - 1]! / 100
}

export function cookEnergy(recipeName: string, extra: number, sunday: boolean, recipeLevel = 1): number {
  const recipe = RECIPES.find((r) => r.name === recipeName)
  if (!recipe) return 0
  const extraEnergy = extra * 30
  const raw = recipe.baseEnergy * recipeLevelMult(recipeLevel) + extraEnergy
  const crit = sunday ? 0.3 * 3 + 0.7 : 0.1 * 2 + 0.9
  return Math.round(raw * crit)
}

export function cookMeals(bag: Record<string, number>, settings: Settings, meals = 3, sunday = false, options: { pot?: number, multiplier?: number } = {}): { meals: CookMeal[], remain: Record<string, number> } {
  const potMul = (settings.goodCamp ? 1.5 : 1) * (sunday || settings.sundayPot ? 2 : 1)
  const pot = options.pot ?? Math.ceil(settings.potSize * potMul)
  const pool = RECIPES.filter((r) => r.category === settings.mealCategory && !r.mix)
    .slice()
    .sort((a, b) => b.baseEnergy * recipeLevelMult(recipeLevelOf(settings, b.name)) - a.baseEnergy * recipeLevelMult(recipeLevelOf(settings, a.name)))
  const remain = { ...bag }
  const out: CookMeal[] = []
  const mix = RECIPES.find((r) => r.category === settings.mealCategory && r.mix)

  for (let i = 0; i < Math.min(21, Math.max(0, Math.floor(meals))); i++) {
    const hit = pool.find((r) => {
      if (r.pot > pot) return false
      return r.ingredients.every((ing) => (remain[ing.name] ?? 0) >= ing.count)
    })
    if (hit) {
      for (const ing of hit.ingredients) remain[ing.name] = (remain[ing.name] ?? 0) - ing.count
      let extra = 0
      let extraEnergy = 0
      const room = pot - hit.pot
      if (room > 0) {
        for (const name of Object.keys(remain).sort((a, b) => (INGREDIENTS.find(x => x.name === b)?.energy ?? 0) - (INGREDIENTS.find(x => x.name === a)?.energy ?? 0))) {
          const take = Math.min(Math.floor(remain[name] ?? 0), room - extra)
          if (take <= 0) continue
          remain[name] -= take
          extra += take
          extraEnergy += take * (INGREDIENTS.find(x => x.name === name)?.energy ?? 0)
          if (extra >= room) break
        }
      }
      out.push({ name: hit.name, mix: false, potUsed: hit.pot + extra, energy: Math.round((hit.baseEnergy * recipeLevelMult(recipeLevelOf(settings, hit.name)) + extraEnergy) * (1 + settings.areaBonus) * (options.multiplier ?? (sunday ? 1.6 : 1.1))) })
    }
    else {
      let used = 0
      let fill = 0
      for (const name of Object.keys(remain).sort((a, b) => (INGREDIENTS.find(x => x.name === b)?.energy ?? 0) - (INGREDIENTS.find(x => x.name === a)?.energy ?? 0))) {
        const take = Math.min(Math.floor(remain[name] ?? 0), pot - used)
        if (take <= 0) continue
        remain[name] -= take
        used += take
        fill += take * (INGREDIENTS.find((x) => x.name === name)?.energy ?? 30)
      }
      const crit = options.multiplier ?? (sunday ? 1.6 : 1.1)
      out.push({
        name: mix?.name ?? '拌拌',
        mix: true,
        potUsed: used,
        energy: Math.round(fill * crit * (1 + settings.areaBonus)),
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
