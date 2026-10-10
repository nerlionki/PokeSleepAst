import { createSleepSimulationTask } from '../../../core/src/composables/sleepSimulationTask'
import type { SleepSimulationMessage, SleepSimulationRequest } from '../../../core/src/calc/sleepSimulation'
import { createCalculationWorker } from './calculationWorker'
export function useSleepSimulation() {
  const state = createSleepSimulationTask(() => {
    const worker = createCalculationWorker<SleepSimulationRequest, SleepSimulationMessage>('sleep', () => new Worker(new URL('../calc/sleepSimulation.worker.ts', import.meta.url), { type: 'module' }), (message) => { state.notice.value = message })
    return { onMessage: (callback) => { worker.onmessage = (event) => callback(event.data) },
      onError: (callback) => { worker.onerror = callback }, postMessage: (request) => worker.postMessage(request), terminate: () => worker.terminate() }
  })
  return state
}
