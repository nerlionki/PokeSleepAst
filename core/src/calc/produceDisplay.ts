import type { ProduceResult } from '../types'

/** Skill food, including extra helps, is already part of the combined total. */
export function breakdownProduceIngredients({ ingredients, skillIngredients }: Pick<ProduceResult, 'ingredients' | 'skillIngredients'>) {
  const natural: Record<string, number> = {}
  const skill: Record<string, number> = {}
  const names = new Set([...Object.keys(ingredients), ...Object.keys(skillIngredients ?? {})])
  for (const name of names) {
    const total = Object.hasOwn(ingredients, name) ? ingredients[name]! : undefined
    const attributed = skillIngredients?.[name] ?? 0
    if (total == null || !Number.isFinite(total) || !Number.isFinite(attributed) || total < 0 || attributed < 0 || attributed - total > 1e-8) {
      if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV) console.warn('食材合计与技能归因不一致', { name, total, attributed })
      return null
    }
    if (total > attributed) natural[name] = total - attributed
    if (attributed > 0) skill[name] = attributed
  }
  return { natural, skill }
}
