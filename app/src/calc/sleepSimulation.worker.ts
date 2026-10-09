import { simulateSleep, type SleepSimulationMessage, type SleepSimulationRequest } from '../../../core/src/calc/sleepSimulation'
const worker = self as unknown as { onmessage: ((event: MessageEvent<SleepSimulationRequest>) => void) | null, postMessage(message: SleepSimulationMessage): void }
worker.onmessage = (event) => simulateSleep(event.data, (message) => worker.postMessage(message))
