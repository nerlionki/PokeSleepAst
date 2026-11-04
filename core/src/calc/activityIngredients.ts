import { ANNOUNCED } from './announcedContent'
import { INGREDIENTS } from './data'

export function ingredientEnergyValue(name: string): number | undefined {
  return INGREDIENTS.find(row => row.name === name)?.energy ?? ANNOUNCED.ingredients.find(row => row.name === name)?.baseEnergy ?? undefined
}
export function assertKnownIngredientEnergy(bag: Readonly<Record<string, number>>, capacity: number) {
  if (capacity <= 0) return
  const unknown = Object.keys(bag).filter(name => Math.floor(bag[name] ?? 0) > 0 && ANNOUNCED.ingredients.some(row => row.name === name) && ingredientEnergyValue(name) == null)
  if (unknown.length) throw new Error(`${unknown.join('、')}能量还未公布，暂无法计算包含这些食材的料理及总收益`)
}
