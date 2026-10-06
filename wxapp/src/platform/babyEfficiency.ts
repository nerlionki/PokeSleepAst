import { computed, onScopeDispose, shallowRef, type Ref } from 'vue'
import { validateBabyEfficiency, type BabyEfficiencyOptions, type BabyEfficiencyResult, type EfficiencyProgress } from '../../../core/src/calc/babyEfficiency'
import type { BabyEfficiencyMessage } from '../../../core/src/calc/babyEfficiencyMessages'
export function useBabyEfficiency(options: Ref<BabyEfficiencyOptions>) {
  const busy = shallowRef(false), error = shallowRef(''), notice = shallowRef('')
  const result = shallowRef<BabyEfficiencyResult | null>(null)
  const progress = shallowRef<EfficiencyProgress>({ percent: 0, island: '', evaluatedStates: 0 })
  const dirty = computed(() => Boolean(result.value && JSON.stringify(result.value.options) !== JSON.stringify(options.value)))
  let worker: WechatMiniprogram.Worker | null = null
  let generation = 0
  function stop() { generation++; worker?.terminate(); worker = null; busy.value = false }
  function cancel() { stop(); notice.value = '已取消计算' }
  async function calculate() {
    if (busy.value) return
    error.value = validateBabyEfficiency(options.value) ?? ''
    if (error.value) return
    notice.value = ''; progress.value = { percent: 0, island: '', evaluatedStates: 0 }
    const active = ++generation
    busy.value = true
    try {
      await new Promise<void>((resolve, reject) => wx.preDownloadSubpackage({ packageType: 'workers', success: () => resolve(), fail: reject }))
      if (active !== generation) return
      const current = wx.createWorker('workers/baby.js', { useExperimentalWorker: true })
      worker = current; busy.value = true
      current.onMessage((event) => {
        const message = event as unknown as BabyEfficiencyMessage
        if (worker !== current) return
        if (message.type === 'progress') progress.value = message.progress
        else if (message.type === 'result') { result.value = message.result; stop() }
        else { error.value = message.message; stop() }
      })
      current.onProcessKilled(() => { if (worker === current) { error.value = '后台计算被微信终止，请重试'; stop() } })
      current.postMessage({ options: { ...options.value } })
    } catch { if (active === generation) { error.value = '无法启动后台计算，请在真机或新版微信中重试'; stop() } }
  }
  onScopeDispose(stop)
  return { busy, error, notice, result, progress, dirty, calculate, cancel }
}
