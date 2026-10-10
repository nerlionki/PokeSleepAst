import { requireWorkerSupport } from './compatibility'
import { computed, onScopeDispose, shallowRef, type Ref } from 'vue'
import { validateBabyEfficiency, type BabyEfficiencyCheckpoint, type BabyEfficiencyOptions, type BabyEfficiencyResult, type EfficiencyProgress } from '../../../core/src/calc/babyEfficiency'
import type { BabyEfficiencyMessage } from '../../../core/src/calc/babyEfficiencyMessages'
const STORAGE_KEY = 'baby-efficiency-checkpoint-v1'
interface SavedTask { options: BabyEfficiencyOptions, checkpoint?: BabyEfficiencyCheckpoint, progress: EfficiencyProgress }
export function useBabyEfficiency(options: Ref<BabyEfficiencyOptions>) {
  const busy = shallowRef(false), error = shallowRef(''), notice = shallowRef('')
  const result = shallowRef<BabyEfficiencyResult | null>(null)
  const progress = shallowRef<EfficiencyProgress>({ percent: 0, island: '', evaluatedStates: 0 })
  const dirty = computed(() => Boolean(result.value && JSON.stringify(result.value.options) !== JSON.stringify(options.value)))
  let worker: WechatMiniprogram.Worker | null = null, generation = 0, foreground = true
  let task: SavedTask | null = null, disposed = false, resumeOnKill = false
  function persist() {
    if (!task) return
    task.progress = { ...progress.value }
    try { wx.setStorageSync?.(STORAGE_KEY, task) }
    catch { notice.value = '存储空间不足，计算继续运行；请保持小程序在前台' }
  }
  function stop(clear = true) {
    generation++; worker?.terminate(); worker = null; busy.value = false
    if (clear) { resumeOnKill = false; task = null; try { wx.removeStorageSync?.(STORAGE_KEY) } catch {} }
  }
  function cancel() { stop(); notice.value = '已取消计算' }
  async function launch() {
    if (!task || worker || disposed) return
    const snapshot = task, active = ++generation
    busy.value = true
    try {
      requireWorkerSupport()
      await new Promise<void>((resolve, reject) => wx.preDownloadSubpackage({ packageType: 'workers', success: () => resolve(), fail: reject }))
      if (active !== generation || disposed || !foreground) return
      const current = wx.createWorker('workers/baby.js', { useExperimentalWorker: true })
      worker = current
      current.onMessage((event) => {
        if (worker !== current || active !== generation) return
        const message = event as unknown as BabyEfficiencyMessage
        if (message.type === 'progress') progress.value = message.progress
        else if (message.type === 'checkpoint') { snapshot.checkpoint = message.checkpoint; persist() }
        else if (message.type === 'result') { result.value = message.result; notice.value = ''; stop() }
        else { error.value = message.message; stop() }
      })
      current.onProcessKilled(() => {
        if (worker !== current) return
        worker = null; generation++; persist()
        notice.value = '计算被微信中断，已保存检查点；返回前台后自动续算'
        // Recover one delayed kill after app show, without looping on foreground failures.
        if (foreground && resumeOnKill) { resumeOnKill = false; void launch() }
        else if (foreground) busy.value = false
      })
      current.postMessage({ options: snapshot.options, checkpoint: snapshot.checkpoint })
    } catch (cause) {
      if (active === generation) { error.value = cause instanceof Error ? cause.message : '无法启动计算，请在真机或新版微信中重试'; stop(false) }
    }
  }
  async function calculate() {
    if (busy.value) return
    error.value = validateBabyEfficiency(options.value) ?? ''
    if (error.value) return
    stop(); notice.value = ''; progress.value = { percent: 0, island: '', evaluatedStates: 0 }
    task = { options: { ...options.value }, progress: { ...progress.value } }; persist()
    await launch()
  }
  const hide = () => { foreground = false; resumeOnKill = true; persist(); notice.value = task ? '微信可能暂停后台计算，返回前台后自动续算' : '' }
  const show = () => {
    foreground = true
    if (task && !worker) { resumeOnKill = false; notice.value = '正在从已保存的检查点续算'; void launch() }
  }
  wx.onAppHide?.(hide); wx.onAppShow?.(show)
  try {
    const saved = wx.getStorageSync?.(STORAGE_KEY) as SavedTask | undefined
    if (saved?.options && !validateBabyEfficiency(saved.options)) {
      task = saved; progress.value = saved.progress ?? { percent: 0, island: '', evaluatedStates: 0 }; notice.value = '正在恢复上次未完成的计算'; void launch()
    }
  } catch { /* A corrupt or unavailable local record must not block new calculations. */ }
  onScopeDispose(() => { disposed = true; wx.offAppHide?.(hide); wx.offAppShow?.(show); stop() })
  return { busy, error, notice, result, progress, dirty, calculate, cancel }
}
