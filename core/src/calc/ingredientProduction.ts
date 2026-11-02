import { POKEDEX } from './data'
import { defaultSettings } from './defaults'
import { snapshotActivity } from './activities'
import { extremeInputs, ingredientYield, productionRankingSettings } from './extremeProduction'
import { resourceRevision } from '../resources/runtime'
import type { ProduceInput, Settings } from '../types'
export interface ProducerRank {
  id: number
  name: string
  total: number
  ordinary: number
  skill: number
  input: ProduceInput
}
const cache = new Map<string, ProducerRank[]>()
export function* topIngredientProducerSteps(ingredientId: number, settings: Settings = defaultSettings()): Generator<void, ProducerRank[]> {
  const context = snapshotActivity(productionRankingSettings(settings))
  const key = JSON.stringify([resourceRevision(), ingredientId, context])
  if (cache.has(key)) return cache.get(key)!
  const rows: ProducerRank[] = []
  for (const poke of POKEDEX.filter(poke => poke.interval > 0 && poke.ingredients.some(item => item.id === ingredientId))) {
    let best: ProducerRank | undefined
    for (const input of extremeInputs(poke.id, 'ingredients', 'unlimited', ingredientId)) {
      const result = ingredientYield(context, input, ingredientId)
      if (!best || result.total > best.total) best = { id: poke.id, name: poke.name, ...result }
      yield
    }
    if (best && best.total > 0) rows.push(best)
  }
  const result = rows.sort((a, b) => b.total - a.total || a.id - b.id).slice(0, 3)
  if (cache.size > 40) cache.clear()
  cache.set(key, result)
  return result
}
export function topIngredientProducers(ingredientId: number): ProducerRank[] {
  const steps = topIngredientProducerSteps(ingredientId)
  let next = steps.next(); while (!next.done) next = steps.next()
  return next.value
}
