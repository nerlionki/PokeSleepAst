import type { CarryMode, ProduceInput, Settings } from '../types'
import { POKEDEX, pokeById } from './data'
import { defaultSettings } from './defaults'
import { skillByPokedexName } from './mainSkills'
import { produce } from './produce'
import { snapshotActivity } from './activities'
import { extremeInput, extremeInputs } from './extremeProduction'
import { resourceRevision } from '../resources/runtime'
import { compareHelpingBonus } from './member'

export interface BerryProducer {
  id: number
  name: string
  total: number
  ordinary: number
  skill: number
  mode: CarryMode
  condition: string
  input: ProduceInput
}

/** User-confirmed extreme panels: Lv70, 2000-hour ribbon, fixed 100 energy,
 * capped main skill, five Helping Bonuses and optimized nature/subskills/food.
 * Legacy inventory modes retain separate ranking places. Only self yields count.
 */
export function berryProducerInput(pokeId: number, carryMode: CarryMode = 'preset'): ProduceInput {
  return extremeInput(pokeId, carryMode)
}

export function berryProducerModes(pokeId: number): CarryMode[] {
  const poke = pokeById(pokeId)
  if (!poke) return []
  const skill = skillByPokedexName(poke.mainSkill, poke.id)
  if (poke.specialty === '树果型') return skill?.id === 9 ? ['full', 'normal', 'unlimited'] : ['full', 'normal']
  if (skill?.name.includes('树果骤增')) return ['unlimited']
  return ['normal']
}

const conditions: Partial<Record<CarryMode, string>> = { full: '全时满包', normal: '一般', unlimited: '无持有上限' }

const cache = new Map<string, BerryProducer[]>()
export function* topBerryProducerSteps(name: string, settings: Settings = defaultSettings()): Generator<void, BerryProducer[]> {
  const context = snapshotActivity({ ...settings, period: 'day' as const, helpingBonus: 0 })
  const key = JSON.stringify([resourceRevision(), name, context])
  if (cache.has(key)) return cache.get(key)!
  const rows: BerryProducer[] = []
  for (const poke of POKEDEX.filter(poke => poke.berry === name && poke.interval > 0)) for (const mode of berryProducerModes(poke.id)) {
    let best: BerryProducer | undefined
    for (const input of extremeInputs(poke.id, 'berries', mode)) {
      const helpingBonus = compareHelpingBonus(input.level, input.subskills, 0)
      const result = produce(context, input, helpingBonus, undefined, { skipCooking: true })
      if (!best || result.berries > best.total) {
        const skill = result.skillBerries ?? 0
        best = { id: poke.id, name: poke.name, total: result.berries, ordinary: result.berries - skill,
          skill, mode, condition: conditions[mode]!, input }
      }
      yield
    }
    if (best) rows.push(best)
  }
  const result = rows.sort((a, b) => b.total - a.total || a.id - b.id || a.condition.localeCompare(b.condition)).slice(0, 5)
  if (cache.size > 36) cache.clear()
  cache.set(key, result)
  return result
}
export function topBerryProducers(name: string, settings: Settings = defaultSettings()): BerryProducer[] {
  const steps = topBerryProducerSteps(name, settings)
  let next = steps.next(); while (!next.done) next = steps.next()
  return next.value
}
