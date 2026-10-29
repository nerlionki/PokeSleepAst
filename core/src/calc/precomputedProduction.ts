import calculationTables from '../data/calc-tables.resource'
import bundledTables from '../data/calc-tables.json'

export interface FixedProducer {
  id: number
  name: string
  total: number
  mode?: string
}
interface FixedRankings {
  berries: Record<string, FixedProducer[]>
  ingredients: Record<string, FixedProducer[]>
}
function currentRankings() {
  // The selected network context supplies its own precomputed table through the
  // existing verified resource bundle. Older/cached bundles retain local fallback.
  return (calculationTables.modules.productionRankings ?? bundledTables.modules.productionRankings) as FixedRankings
}
export function fixedBerryProducers(name: string): readonly FixedProducer[] {
  return currentRankings().berries[name] ?? []
}
export function fixedIngredientProducers(id: number): readonly FixedProducer[] {
  return currentRankings().ingredients[id] ?? []
}
