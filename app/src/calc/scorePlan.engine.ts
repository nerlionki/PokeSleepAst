import { scoreSearchSteps } from '../../../core/src/calc/scoreSearch'
import type { ScoreRequest } from '../../../core/src/calc/scorePlan'
self.onmessage = ({ data }: MessageEvent<ScoreRequest>) => {
  try {
    const steps = scoreSearchSteps(data)
    const tick = () => {
      try {
        const next = steps.next()
        if (next.done) self.postMessage({ type: 'result', result: next.value })
        else { const state = next.value; self.postMessage({ type: 'progress', completed: state.phase === 'search' ? state.index : state.policies.length + state.index,
          total: state.policies.length + 5 }); setTimeout(tick, 0) }
      } catch (cause) { self.postMessage({ type: 'error', message: cause instanceof Error ? cause.message : '规划失败' }) }
    }
    tick()
  } catch (cause) { self.postMessage({ type: 'error', message: cause instanceof Error ? cause.message : '规划失败' }) }
}
