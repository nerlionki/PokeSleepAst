import type { IslandId, SleepType } from '../types'
import { sleepExpect, sleepExpectSteps, type SleepExpectCheckpoint, type DrawOpts } from './sleep'
export interface SleepSimulationRequest {
  checkpoint?: SleepSimulationCheckpoint
  island: IslandId
  sleepType: SleepType
  powers: number[]
  iterations: number
  seed: number
  options: Pick<DrawOpts, 'rank' | 'discovered' | 'undiscoveredBoost' | 'rare' | 'shinyUp' | 'eventMix' | 'eventMult' | 'pokemonUps'>
}
export interface SleepSimulationCheckpoint { powerIndex: number, result: SleepSimulationRows, session?: SleepExpectCheckpoint }
export type SleepSimulationRows = ReturnType<typeof sleepExpect>
export type SleepSimulationMessage = { type: 'progress', completed: number, total: number }
  | { type: 'checkpoint', checkpoint: SleepSimulationCheckpoint }
  | { type: 'result', result: SleepSimulationRows } | { type: 'error', message: string }
/** Runs exclusively inside a platform worker; each split session keeps its own seed/budget. */
export function simulateSleep(request: SleepSimulationRequest, emit: (message: SleepSimulationMessage) => void): void {
  try {
    if (!Number.isInteger(request.iterations) || request.iterations < 1 || request.iterations > 100000
      || !request.powers.length || request.powers.length > 2 || request.powers.some((power) => !Number.isFinite(power) || power < 0)) {
      throw new Error('模拟参数无效，请重新设置')
    }
    const total = request.iterations * request.powers.length
    emit({ type: 'progress', completed: 0, total })
    const result = request.powers.flatMap((power, index) => sleepExpect(request.island, request.sleepType, power,
      request.iterations, 'normal', { ...request.options, seed: request.seed + index },
      (completed) => emit({ type: 'progress', completed: index * request.iterations + completed, total })))
    emit({ type: 'result', result })
  } catch (cause) { emit({ type: 'error', message: cause instanceof Error ? cause.message : '模拟失败，请重试' }) }
}

/** Resume after every 100 researches without changing the random sequence. */
export function* sleepSimulationSteps(request: SleepSimulationRequest): Generator<SleepSimulationCheckpoint, SleepSimulationRows> {
  if (!Number.isInteger(request.iterations) || request.iterations < 1 || request.iterations > 100000
    || !request.powers.length || request.powers.length > 2 || request.powers.some((power) => !Number.isFinite(power) || power < 0)) throw new Error('模拟参数无效，请重新设置')
  const checkpoint = request.checkpoint
  const result = [...(checkpoint?.result ?? [])]
  for (let index = checkpoint?.powerIndex ?? 0; index < request.powers.length; index++) {
    const steps = sleepExpectSteps(request.island, request.sleepType, request.powers[index]!, request.iterations, 'normal',
      { ...request.options, seed: request.seed + index }, undefined, index === checkpoint?.powerIndex ? checkpoint.session : undefined)
    let next = steps.next()
    while (!next.done) { yield { powerIndex: index, result, session: next.value }; next = steps.next() }
    result.push(...next.value)
    yield { powerIndex: index + 1, result }
  }
  return result
}
