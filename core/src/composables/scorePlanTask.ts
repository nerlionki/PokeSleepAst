import { computed, onScopeDispose, shallowRef } from 'vue'
import { scoreFingerprint } from '../calc/scoreSearch'
import type { ScoreMessage, ScoreRequest, ScoreResult } from '../calc/scorePlan'
export interface ScoreWorker {
  onmessage: ((event: { data: ScoreMessage }) => void) | null
  onerror: ((error?: unknown) => void) | null
  postMessage(request: ScoreRequest): void
  terminate(): void
}
export function createScorePlanTask(createWorker: (notice: (message: string) => void) => ScoreWorker | Promise<ScoreWorker>,
  currentInput: () => ScoreRequest) {
  const busy = shallowRef(false), error = shallowRef(''), notice = shallowRef('')
  const result = shallowRef<ScoreResult | null>(null), progress = shallowRef({ completed: 0, total: 1 })
  let worker: ScoreWorker | null = null, generation = 0, lastFingerprint = ''
  const dirty = computed(() => Boolean(result.value && lastFingerprint !== scoreFingerprint(currentInput())))
  function stop() { generation++; worker?.terminate(); worker = null; busy.value = false }
  function cancel() { stop(); notice.value = '已取消规划' }
  async function calculate(restored?: ScoreRequest) {
    if (busy.value) return
    const snapshot: ScoreRequest = JSON.parse(JSON.stringify(restored ?? currentInput()))
    const active = ++generation
    lastFingerprint = scoreFingerprint(snapshot)
    busy.value = true; error.value = ''; notice.value = ''; result.value = null; progress.value = { completed: 0, total: 1 }
    try {
      const current = await createWorker(message => { if (active === generation) notice.value = message })
      if (active !== generation) { current.terminate(); return }
      worker = current
      current.onmessage = ({ data }) => {
        if (worker !== current || generation !== active) return
        if (data.type === 'progress') progress.value = { completed: data.completed, total: data.total }
        else if (data.type === 'result') { result.value = data.result; stop() }
        else if (data.type === 'error') { error.value = data.message; stop() }
      }
      current.onerror = () => { if (worker === current) { error.value = '规划中断，请重新规划'; stop() } }
      current.postMessage(snapshot)
    } catch (cause) { if (active === generation) { error.value = cause instanceof Error ? cause.message : '无法启动规划'; stop() } }
  }
  onScopeDispose(stop)
  return { busy, error, notice, result, progress, dirty, calculate, cancel }
}
