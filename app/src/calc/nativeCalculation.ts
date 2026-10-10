import { babyEfficiencySteps } from '../../../core/src/calc/babyEfficiency'
import { sleepSimulationSteps, type SleepSimulationRequest } from '../../../core/src/calc/sleepSimulation'
import type { BabyEfficiencyRequest } from '../../../core/src/calc/babyEfficiencyMessages'
let steps: ReturnType<typeof babyEfficiencySteps> | null = null
let progress: unknown = null
let sleepSteps: ReturnType<typeof sleepSimulationSteps> | null = null
let total = 0, iterations = 0
export function beginTask(kind: 'baby' | 'sleep', request: BabyEfficiencyRequest | SleepSimulationRequest) {
  steps = null; sleepSteps = null; progress = null
  if (kind === 'baby') {
    const baby = request as BabyEfficiencyRequest
    steps = babyEfficiencySteps(baby.options, (value) => { progress = value }, undefined, baby.checkpoint)
  } else {
    const sleep = request as SleepSimulationRequest
    sleepSteps = sleepSimulationSteps(sleep); total = sleep.iterations * sleep.powers.length; iterations = sleep.iterations
  }
}
export function nextTask(): string {
  try {
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
