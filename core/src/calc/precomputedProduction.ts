import calculationTables from '../data/calc-tables.resource'
import { ribbonBonus, stagesLeft } from './ribbon'

export interface FixedProducer {
  id: number
  name: string
  total: number
  mode?: string
  condition?: string
  ordinary?: number
  skill?: number
}
interface FixedRankings {
  ribbonHours: number
  berries: Record<string, FixedProducer[]>
  ingredients: Record<string, FixedProducer[]>
}
/** Mark only ranking panels whose speed or finite inventory uses the ribbon. */
export function productionRibbonHours(pokeId: number, mode = 'unlimited'): number {
  const hours = currentRankings().ribbonHours
  if (hours < 2000) return 0
  const bonus = ribbonBonus(hours, stagesLeft(pokeId))
  return bonus.speedCut > 0 || (mode === 'normal' && bonus.carry > 0) ? hours : 0
}
function currentRankings() {
  // The selected network context supplies its own precomputed table through the
  // existing verified resource bundle. Missing tables invalidate the whole snapshot.
  return calculationTables.modules.productionRankings as FixedRankings
}
export function fixedBerryProducers(name: string): readonly FixedProducer[] {
  return currentRankings().berries[name] ?? []
}
export function fixedIngredientProducers(id: number): readonly FixedProducer[] {
  return currentRankings().ingredients[id] ?? []
}
