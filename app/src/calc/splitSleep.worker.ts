import { splitSleepSteps, type SplitMessage, type SplitRequest } from '../../../core/src/calc/splitSleep'
const worker = self as unknown as { onmessage: ((event: MessageEvent<SplitRequest>) => void) | null, postMessage(message: SplitMessage): void }
worker.onmessage = ({ data }) => {
  try {
    const steps = splitSleepSteps(data)
    let next = steps.next()
    while (!next.done) {
      worker.postMessage({ type: 'progress', completed: next.value.completed, total: data.splitOptions.targets.length * 100 * (data.splitOptions.sleepType === 'all' ? 4 : 1) })
      next = steps.next()
    }
    worker.postMessage({ type: 'result', result: next.value })
  } catch (cause) { worker.postMessage({ type: 'error', message: cause instanceof Error ? cause.message : '计算失败，请重试' }) }
}
