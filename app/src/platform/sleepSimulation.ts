import { createSleepSimulationTask } from '../../../core/src/composables/sleepSimulationTask'
export function useSleepSimulation() {
  return createSleepSimulationTask(() => {
    const worker = new Worker(new URL('../calc/sleepSimulation.worker.ts', import.meta.url), { type: 'module' })
    return { onMessage: (callback) => { worker.onmessage = (event) => callback(event.data) },
      onError: (callback) => { worker.onerror = callback }, postMessage: (request) => worker.postMessage(request), terminate: () => worker.terminate() }
  })
}
