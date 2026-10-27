import runtimeParameters from '../data/runtime-parameters.json'
import ruleCatalogs from '../data/rule-catalogs.json'
import ruleParameters from '../data/rule-parameters.json'
import { activityValues, createActivityContext, type ActivityContext } from './activities'
import { normalizeEventMix } from './sleepRules'
import type { IslandId, SleepType } from '../types'
import { encounterCount, sleepExpect, sleepExpectSteps, type SleepExpectCheckpoint, type DrawOpts } from './sleep'
const sleepSimulation_prepareActivityRequest_runtimeParameters = runtimeParameters.modules.sleepSimulation.prepareActivityRequest.values
const sleepSimulation_validResearchOptions_runtimeParameters = runtimeParameters.modules.sleepSimulation.validResearchOptions.values
const sleepSimulation_config_ruleCatalogs = ruleCatalogs.modules.sleepSimulation
const sleepSimulation_simulateSleep_ruleParameters = ruleParameters.modules.sleepSimulation.simulateSleep
const sleepSimulation_sleepSimulationSteps_ruleParameters = ruleParameters.modules.sleepSimulation.sleepSimulationSteps
const sleepSimulation_sleepSimulationSteps_runtimeParameters = runtimeParameters.modules.sleepSimulation.sleepSimulationSteps.values

export interface SleepSimulationRequest {
  checkpoint?: SleepSimulationCheckpoint
  island: IslandId
  sleepType: SleepType
  powers: number[]
  iterations: number
  seed: number
  options: Pick<DrawOpts, 'activity' | 'researchedBefore' | 'researchLimit' | 'firstResearchExtras' | 'rank' | 'discovered' | 'undiscoveredBoost' | 'rare' | 'shinyUp' | 'eventMix' | 'eventMult' | 'pokemonUps' | 'researchExpBonus' | 'shardBonus' | 'focusIncense' | 'luckIncense'> & { incenseSession?: 0 | 1 }
}
export interface SleepSimulationCheckpoint { version: 4, activity?: ActivityContext, powerIndex: number, result: SleepSimulationRows, session?: SleepExpectCheckpoint }
export type SleepSimulationRows = ReturnType<typeof sleepExpect>
export type SleepSimulationMessage = { type: 'progress', completed: number, total: number }
  | { type: 'checkpoint', checkpoint: SleepSimulationCheckpoint }
  | { type: 'result', result: SleepSimulationRows } | { type: 'error', message: string }
function prepareActivityRequest(request: SleepSimulationRequest): SleepSimulationRequest {
  const activity = createActivityContext('research', request.checkpoint?.activity ?? request.options.activity)
  const effects = activityValues(activity, request.island, undefined, (sleepSimulation_prepareActivityRequest_runtimeParameters.p001 as 240), { drowsyPowerMultiplier: request.options.eventMult ?? 1, eventMix: normalizeEventMix(request.options.eventMix), shinyUp: request.options.shinyUp ?? false })
  const changed = effects.drowsyPowerMultiplier !== (request.options.eventMult ?? 1)
  return { ...request, powers: changed ? request.powers.map(power => power / (request.options.eventMult ?? 1) * effects.drowsyPowerMultiplier) : request.powers,
    options: { ...request.options, activity, eventMult: effects.drowsyPowerMultiplier, eventMix: effects.eventMix, shinyUp: effects.shinyUp } }
}
function researchOptions(request: SleepSimulationRequest, index: number): DrawOpts & { seed: number } {
  return { ...request.options,
    focusIncense: index === (request.options.incenseSession ?? 0) && request.options.focusIncense,
    luckIncense: index === (request.options.incenseSession ?? 0) && request.options.luckIncense,
    researchedBefore: (request.options.researchedBefore ?? 0) + (index ? encounterCount(request.island, request.powers[0]!) + (request.options.firstResearchExtras ?? 0) : 0), seed: request.seed + index } as DrawOpts & { seed: number }
}
function validResearchOptions(request: SleepSimulationRequest) {
  return [request.options.researchedBefore ?? 0, request.options.firstResearchExtras ?? 0].every(value => Number.isInteger(value) && value >= 0 && value <= (sleepSimulation_validResearchOptions_runtimeParameters.p001 as 100))
    && sleepSimulation_config_ruleCatalogs.validResearchOptionsList0.values.includes(request.options.researchLimit ?? (sleepSimulation_validResearchOptions_runtimeParameters.p002 as 10))
    && [request.options.researchExpBonus ?? 0, request.options.shardBonus ?? 0].every(value => Number.isInteger(value) && value >= 0 && value <= (sleepSimulation_validResearchOptions_runtimeParameters.p003 as 5))
    && [0,1].includes(request.options.incenseSession ?? 0)
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
  } catch (cause) { emit({ type: 'error', message: cause instanceof Error ? cause.message : '模拟失败，请重试' }) }
}

/** Resume after every 100 researches without changing the random sequence. */
export function* sleepSimulationSteps(request: SleepSimulationRequest): Generator<SleepSimulationCheckpoint, SleepSimulationRows> {
  request = prepareActivityRequest(request)
  if (!validResearchOptions(request) || !Number.isInteger(request.iterations) || request.iterations < 1 || request.iterations > sleepSimulation_sleepSimulationSteps_ruleParameters.maxIterations
    || !request.powers.length || request.powers.length > 2 || request.powers.some((power) => !Number.isFinite(power) || power < 0)) throw new Error('模拟参数无效，请重新设置')
  const checkpoint = request.checkpoint
  if (checkpoint && checkpoint.version !== 4) throw new Error('睡姿抽选规则已更新，请重新计算')
  const result = [...(checkpoint?.result ?? [])]
  for (let index = checkpoint?.powerIndex ?? 0; index < request.powers.length; index++) {
    const steps = sleepExpectSteps(request.island, request.sleepType, request.powers[index]!, request.iterations, 'normal',
      researchOptions(request, index), undefined, index === checkpoint?.powerIndex ? checkpoint.session : undefined)
    let next = steps.next()
    while (!next.done) { yield { version: (sleepSimulation_sleepSimulationSteps_runtimeParameters.p001 as 4), activity: request.options.activity as ActivityContext, powerIndex: index, result, session: next.value }; next = steps.next() }
    result.push(...next.value)
    yield { version: (sleepSimulation_sleepSimulationSteps_runtimeParameters.p002 as 4), activity: request.options.activity as ActivityContext, powerIndex: index + 1, result }
  }
  return result
}
