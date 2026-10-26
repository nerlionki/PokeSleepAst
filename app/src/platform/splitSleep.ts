import { computed, onScopeDispose, shallowRef, type Ref } from 'vue'
import { createCalculationWorker, type CalculationWorker } from './calculationWorker'
import { validateSplitOptions, type SplitMessage, type SplitOptions, type SplitRequest, type SplitResult } from '../../../core/src/calc/splitSleep'

export function useSplitSleep(options: Ref<SplitOptions>) {
  const busy = shallowRef(false), error = shallowRef(''), notice = shallowRef('')
  const progress = shallowRef({ completed: 0, total: 0 })
  const result = shallowRef<SplitResult | null>(null)
  const dirty = computed(() => !!result.value && JSON.stringify(result.value.options) !== JSON.stringify(options.value))
  let worker: CalculationWorker<SplitRequest, SplitMessage> | null = null
  function stop() { worker?.terminate(); worker = null; busy.value = false }
  function cancel() { stop(); notice.value = '已取消计算' }
  function calculate() {
    if (busy.value) return
    error.value = validateSplitOptions(options.value) ?? ''
    if (error.value) return
    notice.value = ''; progress.value = { completed: 0, total: 0 }
    try {
      const current = createCalculationWorker<SplitRequest, SplitMessage>('baby', () => new Worker(new URL('../calc/splitSleep.worker.ts', import.meta.url), { type: 'module' }), value => { notice.value = value })
      worker = current; busy.value = true
      current.onmessage = ({ data }) => {
        if (worker !== current) return
        if (data.type === 'progress') progress.value = { completed: data.completed, total: data.total }
        else if (data.type === 'result') { result.value = data.result; stop() }
        else if (data.type === 'error') { error.value = data.message; stop() }
      }
      current.onerror = () => { if (worker === current) { error.value = '后台计算失败，请重试'; stop() } }
      current.postMessage({ splitOptions: JSON.parse(JSON.stringify(options.value)) })
    } catch { error.value = '无法启动后台计算，请重试'; stop() }
  }
  onScopeDispose(stop)
  return { busy, error, notice, result, dirty, progress, calculate, cancel }
}
