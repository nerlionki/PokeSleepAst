import type { CarryMode, ProduceInput, Settings } from '../types'
import { POKEDEX, pokeById } from './data'
import { defaultSettings } from './defaults'
import { skillByPokedexName } from './mainSkills'
import { produce } from './produce'
import { snapshotActivity } from './activities'
import { extremeInput, extremeInputs, productionRankingSettings } from './extremeProduction'
import { resourceRevision } from '../resources/runtime'
import { compareHelpingBonus, effectiveSkillLevel } from './member'
import { simulateTeam } from './timeline'
import { applyMainSkill, type EffectActor } from './skillEffects'
import { resolveMemberSkill } from './mew'
import { berryUnitEnergy } from './berry'
import { exEffects } from './exEffects'

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
 * Legacy inventory modes retain separate ranking places. Direct skill berries
 * for four teammates are converted to the ranked berry; support helps stay self-only.
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

/** User-confirmed 2026-10-30: include the other four teammates' direct skill
 * berries as the current berry. Reuse shared skill effects (including disguise),
 * without adding their natural production or support-help production. Duplicate
 * species preserve the default one-species skill tier; no team combo is assumed.
 */
function teammateSkillBerries(input: ProduceInput, procs: number): number {
  if (input.carryMode === 'full' || procs <= 0) return 0
  const poke = pokeById(input.pokeId)!
  const selected = resolveMemberSkill(poke, input)
  const skill = skillByPokedexName(selected.name, poke.id)
  // Copying requires real teammates; the default solo panel has no copy target.
  if (!skill || skill.id === 18 || skill.id === 19) return 0
  const actors: EffectActor[] = Array.from({ length: 5 }, () => ({
    poke: { ...poke, mainSkill: selected.name }, input, energy: 100, factor: 1,
    skillLv: effectiveSkillLevel(input.level, input.skillLevel, input.subskills, selected.name),
    skillRate: selected.rate, unitBerry: 0,
    result: { helps: 0, berries: 0, berryEnergy: 0, ingredients: {}, skillProcs: 0, skillEnergy: 0, sneaky: 0, curve: [] },
  }))
  applyMainSkill(actors[0]!, actors, {
    ingredient() {}, help() {}, pot() {}, crit() {}, skillOnly() {}, charge() {},
  }, procs)
  return actors.slice(1).reduce((sum, actor) => sum + (actor.result.skillBerries ?? 0), 0)
}

/** Every finite-inventory ranking uses the timeline, including skills whose
 * general production panel can use a fast formula. This applies ribbon carry
 * and inventory subskills before modeling overnight filling and sneaky snacking.
 */
export function berryProducerYield(settings: Settings, input: ProduceInput) {
  settings = productionRankingSettings(settings)
  const helpingBonus = compareHelpingBonus(input.level, input.subskills, 0)
  const result = input.carryMode === 'normal'
    ? simulateTeam(settings, [input], helpingBonus, {
      expectedProcs: true, fixedEnergy: input.wakeEnergy ?? 100, skipCooking: true,
    }).members[0]!
    : produce(settings, input, helpingBonus, undefined, { skipCooking: true })
  const extra = teammateSkillBerries(input, result.skillProcs)
  if (extra === 0) return result
  const poke = pokeById(input.pokeId)!
  const unit = berryUnitEnergy(poke.berry, input.level, settings.areaBonus, exEffects(settings, poke.berry, poke.specialty).berryMultiplier)
  return { ...result, berries: result.berries + extra, berryEnergy: result.berryEnergy + extra * unit,
    skillBerries: (result.skillBerries ?? 0) + extra }
}

const cache = new Map<string, BerryProducer[]>()
export function* topBerryProducerSteps(name: string, settings: Settings = defaultSettings()): Generator<void, BerryProducer[]> {
  const context = snapshotActivity(productionRankingSettings(settings))
  const key = JSON.stringify([resourceRevision(), name, context])
  if (cache.has(key)) return cache.get(key)!
  const rows: BerryProducer[] = []
  for (const poke of POKEDEX.filter(poke => poke.berry === name && poke.interval > 0)) for (const mode of berryProducerModes(poke.id)) {
    let best: BerryProducer | undefined
    for (const input of extremeInputs(poke.id, 'berries', mode)) {
      const result = berryProducerYield(context, input)
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
