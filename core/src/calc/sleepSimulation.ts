import runtimeParameters from '../data/runtime-parameters.resource'
import ruleCatalogs from '../data/rule-catalogs.resource'
import ruleParameters from '../data/rule-parameters.resource'
import { activityValues, researchActivity, sameResearchAvailability, type ResearchActivityContext } from './activities'
import { pendingResearchPokemon } from './researchAvailability'
import { normalizeEventMix } from './sleepRules'
import { SleepDrawUnresolvedError, type SleepDrawUnresolved } from './sleepTransition'
import { sha256, utf8 } from '../resources/sha256'
import type { IslandId, SleepType } from '../types'
import { encounterCount, sleepExpect, sleepExpectSteps, type SleepExpectCheckpoint, type DrawOpts } from './sleep'
const sleepSimulation_prepareActivityRequest_runtimeParameters = runtimeParameters.modules.sleepSimulation.prepareActivityRequest.values
const sleepSimulation_validResearchOptions_runtimeParameters = runtimeParameters.modules.sleepSimulation.validResearchOptions.values
const sleepSimulation_config_ruleCatalogs = ruleCatalogs.modules.sleepSimulation
const sleepSimulation_simulateSleep_ruleParameters = ruleParameters.modules.sleepSimulation.simulateSleep
const sleepSimulation_sleepSimulationSteps_ruleParameters = ruleParameters.modules.sleepSimulation.sleepSimulationSteps

export interface SleepSimulationRequest {
  checkpoint?: SleepSimulationCheckpoint
  island: IslandId
  sleepType: SleepType
  powers: number[]
  iterations: number
  seed: number
  options: Pick<DrawOpts, 'campTicket' | 'activity' | 'researchedBefore' | 'researchSession' | 'researchLimit' | 'firstResearchExtras' | 'rank' | 'discovered' | 'undiscoveredBoost' | 'rare' | 'shinyUp' | 'eventMix' | 'eventMult' | 'pokemonUps' | 'researchExpBonus' | 'shardBonus' | 'focusIncense' | 'luckIncense'> & { incenseSession?: 0 | 1 }
  /** Internal comparison runs may provide distinct evidence for each research. */
  studies?: readonly NonNullable<DrawOpts['literatureStudy']>[]
}
export interface SleepSimulationCheckpoint { version: 7, activity?: ResearchActivityContext, powerIndex: number, result: SleepSimulationRows, session?: SleepExpectCheckpoint, studyKey?: string }
export type SleepSimulationRows = ReturnType<typeof sleepExpect>
export type SleepSimulationMessage = { type: 'progress', completed: number, total: number }
  | { type: 'checkpoint', checkpoint: SleepSimulationCheckpoint }
  | { type: 'result', result: SleepSimulationRows } | { type: 'error', message: string, unresolved?: SleepDrawUnresolved }
function prepareActivityRequest(request: SleepSimulationRequest): SleepSimulationRequest {
  const activity = researchActivity(request.checkpoint?.activity ?? request.options.activity, pendingResearchPokemon())
  const effects = activityValues(activity, request.island, undefined, (sleepSimulation_prepareActivityRequest_runtimeParameters.p001 as 240), { drowsyPowerMultiplier: request.options.eventMult ?? 1, eventMix: normalizeEventMix(request.options.eventMix) })
  const changed = effects.drowsyPowerMultiplier !== (request.options.eventMult ?? 1)
  return { ...request, powers: changed ? request.powers.map(power => power / (request.options.eventMult ?? 1) * effects.drowsyPowerMultiplier) : request.powers,
    options: { ...request.options, activity, eventMult: effects.drowsyPowerMultiplier, eventMix: effects.eventMix } }
}
function researchOptions(request: SleepSimulationRequest, index: number): DrawOpts & { seed: number } {
  return { ...request.options, literatureStudy: request.studies?.[index],
    campTicket: Boolean(request.options.campTicket && index === 0 && (request.options.researchSession ?? Number((request.options.researchedBefore ?? 0) > 0)) === 0),
    researchSession: index > 0 || (request.options.researchSession ?? Number((request.options.researchedBefore ?? 0) > 0)) > 0 ? 1 : 0,
    focusIncense: index === (request.options.incenseSession ?? 0) && request.options.focusIncense,
    luckIncense: index === (request.options.incenseSession ?? 0) && request.options.luckIncense,
    researchedBefore: (request.options.researchedBefore ?? 0) + (index ? encounterCount(request.island, request.powers[0]!) + (request.options.firstResearchExtras ?? 0) : 0), seed: request.seed + index } as DrawOpts & { seed: number }
}
function validResearchOptions(request: SleepSimulationRequest) {
  return (!request.studies || (request.studies.length === request.powers.length && request.powers.every((_, index) => Boolean(request.studies?.[index]))))
    && [request.options.researchedBefore ?? 0, request.options.firstResearchExtras ?? 0].every(value => Number.isInteger(value) && value >= 0 && value <= (sleepSimulation_validResearchOptions_runtimeParameters.p001 as 100))
    && sleepSimulation_config_ruleCatalogs.validResearchOptionsList0.values.includes(request.options.researchLimit ?? (sleepSimulation_validResearchOptions_runtimeParameters.p002 as 10))
    && [request.options.researchExpBonus ?? 0, request.options.shardBonus ?? 0].every(value => Number.isInteger(value) && value >= 0 && value <= (sleepSimulation_validResearchOptions_runtimeParameters.p003 as 5))
    && [0,1].includes(request.options.incenseSession ?? 0)
    && [0,1].includes(request.options.researchSession ?? 0)
    && !(request.options.researchSession === 1 && request.powers.length > 1)
}
/** Runs exclusively inside a platform worker; each split session keeps its own seed/budget. */
export function simulateSleep(request: SleepSimulationRequest, emit: (message: SleepSimulationMessage) => void): void {
  try {
    request = prepareActivityRequest(request)
    if (!validResearchOptions(request) || !Number.isInteger(request.iterations) || request.iterations < 1 || request.iterations > sleepSimulation_simulateSleep_ruleParameters.maxIterations
      || !request.powers.length || request.powers.length > 2 || request.powers.some((power) => !Number.isFinite(power) || power < 0)) {
      throw new Error('模拟参数无效，请重新设置')
    }
    const total = request.iterations * request.powers.length
    emit({ type: 'progress', completed: 0, total })
    const result = request.powers.flatMap((power, index) => sleepExpect(request.island, request.sleepType, power,
      request.iterations, 'normal', researchOptions(request, index),
      (completed) => emit({ type: 'progress', completed: index * request.iterations + completed, total })))
    emit({ type: 'result', result })
  } catch (cause) {
    emit(cause instanceof SleepDrawUnresolvedError
      ? { type: 'error', message: cause.message, unresolved: cause.detail }
      : { type: 'error', message: cause instanceof Error ? cause.message : '模拟失败，请重试' })
  }
}

/** Resume after every 100 researches without changing the random sequence. */
export function* sleepSimulationSteps(request: SleepSimulationRequest): Generator<SleepSimulationCheckpoint, SleepSimulationRows> {
  request = prepareActivityRequest(request)
  if (!validResearchOptions(request) || !Number.isInteger(request.iterations) || request.iterations < 1 || request.iterations > sleepSimulation_sleepSimulationSteps_ruleParameters.maxIterations
    || !request.powers.length || request.powers.length > 2 || request.powers.some((power) => !Number.isFinite(power) || power < 0)) throw new Error('模拟参数无效，请重新设置')
  const studyKey = request.studies && sha256(utf8(JSON.stringify([
    request.island, request.sleepType, request.powers, request.seed, request.iterations, request.options, request.studies,
  ])))
  if (request.checkpoint && (request.checkpoint.version !== 7 || request.checkpoint.studyKey !== studyKey)) throw new Error('睡姿抽选规则已更新，请重新计算')
  const checkpoint = sameResearchAvailability(request.checkpoint?.activity, request.options.activity) ? request.checkpoint : undefined
  const result = [...(checkpoint?.result ?? [])]
  for (let index = checkpoint?.powerIndex ?? 0; index < request.powers.length; index++) {
    const steps = sleepExpectSteps(request.island, request.sleepType, request.powers[index]!, request.iterations, 'normal',
      researchOptions(request, index), undefined, index === checkpoint?.powerIndex ? checkpoint.session : undefined)
    let next = steps.next()
    const metadata = { version: 7 as const, activity: request.options.activity as ResearchActivityContext, ...(studyKey ? { studyKey } : {}) }
    while (!next.done) { yield { ...metadata, powerIndex: index, result: [...result], session: next.value }; next = steps.next() }
    result.push(...next.value)
    yield { ...metadata, powerIndex: index + 1, result: [...result] }
  }
  return result
}
