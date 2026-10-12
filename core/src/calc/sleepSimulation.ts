import type { IslandId, SleepType } from '../types'
import { encounterCount, sleepExpect, sleepExpectSteps, type SleepExpectCheckpoint, type DrawOpts } from './sleep'
export interface SleepSimulationRequest {
  checkpoint?: SleepSimulationCheckpoint
  island: IslandId
  sleepType: SleepType
  powers: number[]
  iterations: number
  seed: number
  options: Pick<DrawOpts, 'researchedBefore' | 'researchLimit' | 'firstResearchExtras' | 'rank' | 'discovered' | 'undiscoveredBoost' | 'rare' | 'shinyUp' | 'eventMix' | 'eventMult' | 'pokemonUps' | 'researchExpBonus' | 'shardBonus' | 'focusIncense' | 'luckIncense'> & { incenseSession?: 0 | 1 }
}
export interface SleepSimulationCheckpoint { version: 2, powerIndex: number, result: SleepSimulationRows, session?: SleepExpectCheckpoint }
export type SleepSimulationRows = ReturnType<typeof sleepExpect>
export type SleepSimulationMessage = { type: 'progress', completed: number, total: number }
  | { type: 'checkpoint', checkpoint: SleepSimulationCheckpoint }
  | { type: 'result', result: SleepSimulationRows } | { type: 'error', message: string }
function researchOptions(request: SleepSimulationRequest, index: number): DrawOpts & { seed: number } {
  return { ...request.options,
    focusIncense: index === (request.options.incenseSession ?? 0) && request.options.focusIncense,
    luckIncense: index === (request.options.incenseSession ?? 0) && request.options.luckIncense,
    researchedBefore: (request.options.researchedBefore ?? 0) + (index ? encounterCount(request.island, request.powers[0]!) + (request.options.firstResearchExtras ?? 0) : 0), seed: request.seed + index } as DrawOpts & { seed: number }
}
function validResearchOptions(request: SleepSimulationRequest) {
  return [request.options.researchedBefore ?? 0, request.options.firstResearchExtras ?? 0].every(value => Number.isInteger(value) && value >= 0 && value <= 100)
    && [10,11].includes(request.options.researchLimit ?? 10)
    && [request.options.researchExpBonus ?? 0, request.options.shardBonus ?? 0].every(value => Number.isInteger(value) && value >= 0 && value <= 5)
    && [0,1].includes(request.options.incenseSession ?? 0)
}
/** Runs exclusively inside a platform worker; each split session keeps its own seed/budget. */
export function simulateSleep(request: SleepSimulationRequest, emit: (message: SleepSimulationMessage) => void): void {
  try {
    if (!validResearchOptions(request) || !Number.isInteger(request.iterations) || request.iterations < 1 || request.iterations > 100000
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
  if (!validResearchOptions(request) || !Number.isInteger(request.iterations) || request.iterations < 1 || request.iterations > 100000
    || !request.powers.length || request.powers.length > 2 || request.powers.some((power) => !Number.isFinite(power) || power < 0)) throw new Error('模拟参数无效，请重新设置')
  const checkpoint = request.checkpoint
  if (checkpoint && checkpoint.version !== 2) throw new Error('研究奖励规则已更新，请重新计算')
  const result = [...(checkpoint?.result ?? [])]
  for (let index = checkpoint?.powerIndex ?? 0; index < request.powers.length; index++) {
    const steps = sleepExpectSteps(request.island, request.sleepType, request.powers[index]!, request.iterations, 'normal',
      researchOptions(request, index), undefined, index === checkpoint?.powerIndex ? checkpoint.session : undefined)
    let next = steps.next()
    while (!next.done) { yield { version: 2, powerIndex: index, result, session: next.value }; next = steps.next() }
    result.push(...next.value)
    yield { version: 2, powerIndex: index + 1, result }
  }
  return result
}
