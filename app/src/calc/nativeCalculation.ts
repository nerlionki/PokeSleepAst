import { babyEfficiencySteps } from '../../../core/src/calc/babyEfficiency'
import { sleepSimulationSteps, type SleepSimulationRequest } from '../../../core/src/calc/sleepSimulation'
import type { BabyEfficiencyRequest } from '../../../core/src/calc/babyEfficiencyMessages'
import { scoreSearchSteps } from '../../../core/src/calc/scoreSearch'
import type { ScoreRequest } from '../../../core/src/calc/scorePlan'
import { splitSleepSteps, type SplitRequest } from '../../../core/src/calc/splitSleep'
let splitSteps: ReturnType<typeof splitSleepSteps> | null = null
let splitTotal = 0
let scoreSteps: ReturnType<typeof scoreSearchSteps> | null = null
let steps: ReturnType<typeof babyEfficiencySteps> | null = null
let progress: unknown = null
let sleepSteps: ReturnType<typeof sleepSimulationSteps> | null = null
let total = 0, iterations = 0
export function beginTask(kind: 'baby' | 'sleep' | 'score', request: BabyEfficiencyRequest | SleepSimulationRequest | ScoreRequest | SplitRequest) {
  steps = null; sleepSteps = null; scoreSteps = null; splitSteps = null; progress = null
  if (kind === 'baby') {
    if ('splitOptions' in request) {
      splitSteps = splitSleepSteps(request)
      splitTotal = request.splitOptions.targets.length * 100 * (request.splitOptions.sleepType === 'all' ? 4 : 1)
      return
    }
    const baby = request as BabyEfficiencyRequest
    steps = babyEfficiencySteps(baby.options, (value) => { progress = value }, undefined, baby.checkpoint)
  } else if (kind === 'score') {
    scoreSteps = scoreSearchSteps(request as ScoreRequest)
  } else {
    const sleep = request as SleepSimulationRequest
    sleepSteps = sleepSimulationSteps(sleep); total = sleep.iterations * sleep.powers.length; iterations = sleep.iterations
  }
}
export function nextTask(): string {
  try {
    if (splitSteps) {
      const next = splitSteps.next()
      return JSON.stringify(next.done ? { type: 'result', result: next.value } : { type: 'progress', completed: next.value.completed, total: splitTotal })
    }
    if (scoreSteps) {
      const next = scoreSteps.next()
      if (next.done) return JSON.stringify({ type: 'result', result: next.value })
      const state = next.value
      return JSON.stringify({ type: 'progress', completed: state.phase === 'search' ? state.index : state.policies.length + state.index, total: state.policies.length + 5 })
    }
    if (steps) {
      const next = steps.next()
      return JSON.stringify(next.done ? { type: 'result', result: next.value } : { type: 'progress', progress })
    }
    if (sleepSteps) {
      const next = sleepSteps.next()
      return JSON.stringify(next.done ? { type: 'result', result: next.value } : { type: 'progress', completed: next.value.powerIndex * iterations + (next.value.session?.completed ?? 0), total })
    }
    return JSON.stringify({ type: 'error', message: '没有可运行的计算任务' })
  } catch (cause) { return JSON.stringify({ type: 'error', message: cause instanceof Error ? cause.message : '计算失败' }) }
}
