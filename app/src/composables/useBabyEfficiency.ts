import { createCalculationWorker, type CalculationWorker } from '../platform/calculationWorker'
import type { BabyEfficiencyRequest } from '../calc/babyEfficiencyMessages'
import { computed, onScopeDispose, shallowRef, type Ref } from 'vue'
import { validateBabyEfficiency, type BabyEfficiencyOptions, type BabyEfficiencyResult, type EfficiencyProgress } from '../calc/babyEfficiency'
import type { BabyEfficiencyMessage } from '../calc/babyEfficiencyMessages'

export function useBabyEfficiency(options: Ref<BabyEfficiencyOptions>) {
  const busy = shallowRef(false)
  const error = shallowRef('')
  const notice = shallowRef('')
  const result = shallowRef<BabyEfficiencyResult | null>(null)
  const progress = shallowRef<EfficiencyProgress>({ percent: 0, island: '', evaluatedStates: 0 })
  const dirty = computed(() => Boolean(result.value && JSON.stringify(result.value.options) !== JSON.stringify(options.value)))
  let worker: CalculationWorker<BabyEfficiencyRequest, BabyEfficiencyMessage> | null = null
  function stop() {
    worker?.terminate()
    worker = null
    busy.value = false
  }
  function cancel() {
    stop()
    notice.value = '已取消计算'
  }
  function calculate() {
    if (busy.value) return
    error.value = validateBabyEfficiency(options.value) ?? ''
    if (error.value) return
    notice.value = ''
    progress.value = { percent: 0, island: '', evaluatedStates: 0 }
    try {
      const current = createCalculationWorker<BabyEfficiencyRequest, BabyEfficiencyMessage>('baby', () => new Worker(new URL('../calc/babyEfficiency.worker.ts', import.meta.url), { type: 'module' }), (message) => { notice.value = message })
      worker = current
      busy.value = true
      current.onmessage = (event: { data: BabyEfficiencyMessage }) => {
        if (worker !== current) return
        const message = event.data
        if (message.type === 'progress') progress.value = message.progress
        else if (message.type === 'result') {
          result.value = message.result
          stop()
        } else if (message.type === 'error') {
          error.value = message.message
          stop()
        }
      }
      current.onerror = (cause) => {
        if (worker !== current) return
        error.value = cause instanceof Error ? cause.message : '后台计算失败，请重新尝试'
        stop()
      }
      // Send plain data instead of a reactive proxy.
      current.postMessage({ options: { ...options.value } })
    } catch {
      error.value = '无法启动后台计算，请重新尝试'
      stop()
    }
  }
  onScopeDispose(stop)
  return { busy, error, notice, result, progress, dirty, calculate, cancel }
}
