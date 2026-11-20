import { createCalculationWorker } from './calculationWorker'
import { createPlanningTask, createScorePlanTask } from '../../../core/src/composables/scorePlanTask'
import type { ScoreMessage, ScoreRequest } from '../../../core/src/calc/scorePlan'
import type { MealPlanMessage, MealPlanRequest, MealPlanResult } from '../../../core/src/calc/mealPlan'
const scoreWorker = () => new Worker(new URL('../calc/scorePlan.worker.ts', import.meta.url), { type: 'module' })
export function useScorePlan(currentInput: () => ScoreRequest) {
  const task = createScorePlanTask(notice => createCalculationWorker<ScoreRequest, ScoreMessage>('score',
    scoreWorker, notice), currentInput)
  return { ...task, restore: () => {} }
}

export function useMealPlan(currentInput: () => MealPlanRequest) {
  return createPlanningTask<MealPlanRequest, MealPlanResult, MealPlanMessage>(notice =>
    createCalculationWorker<MealPlanRequest, MealPlanMessage>('score', scoreWorker, notice), currentInput)
}
