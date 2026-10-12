import { createCalculationWorker } from './calculationWorker'
import { createScorePlanTask } from '../../../core/src/composables/scorePlanTask'
import type { ScoreMessage, ScoreRequest } from '../../../core/src/calc/scorePlan'
export function useScorePlan(currentInput: () => ScoreRequest) {
  const task = createScorePlanTask(notice => createCalculationWorker<ScoreRequest, ScoreMessage>('score',
    () => new Worker(new URL('../calc/scorePlan.worker.ts', import.meta.url), { type: 'module' }), notice), currentInput)
  return { ...task, restore: () => {} }
}
