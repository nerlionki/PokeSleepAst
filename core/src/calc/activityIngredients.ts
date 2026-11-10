import { ANNOUNCED } from './announcedContent'
import { ingredientKey, ingredientLabel, ingredientRow } from './catalogIds'

export function ingredientEnergyValue(key: string): number | undefined {
  const id = ingredientKey(key)
  return (id ? ingredientRow(id)?.energy : undefined)
    ?? ANNOUNCED.ingredients.find(row => `announced:${row.key}` === id)?.baseEnergy ?? undefined
}
export function assertKnownIngredientEnergy(bag: Readonly<Record<string, number>>, capacity: number) {
  if (capacity <= 0) return
  const unknown = Object.keys(bag).filter(key => Math.floor(bag[key] ?? 0) > 0 && ingredientEnergyValue(key) == null)
  if (unknown.length) throw new Error(`${unknown.map(ingredientLabel).join('、')}能量还未公布，暂无法计算包含这些食材的料理及总收益`)
}
