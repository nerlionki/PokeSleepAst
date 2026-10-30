import { withResources, resourceRevision, compatibleCheckpoint } from '../../../core/src/resources/runtime'
import { computed, onScopeDispose, shallowRef, type Ref } from 'vue'
import { requireWorkerSupport } from './compatibility'
import { workerErrorMessage } from './workerError'
import { validateSplitOptions, type SplitCheckpoint, type SplitMessage, type SplitOptions, type SplitResult } from '../../../core/src/calc/splitSleep'

interface SavedTask { resourceRevision?: string; options: SplitOptions, checkpoint?: SplitCheckpoint, progress: { completed: number, total: number } }
export function useSplitSleep(options: Ref<SplitOptions>) {
  const key = 'split-sleep-checkpoint-v1'
  const busy = shallowRef(false), error = shallowRef(''), notice = shallowRef('')
  const progress = shallowRef({ completed: 0, total: 0 }), result = shallowRef<SplitResult | null>(null)
  const dirty = computed(() => !!result.value && JSON.stringify(result.value.options) !== JSON.stringify(options.value))
  let task: SavedTask | null = null, worker: WechatMiniprogram.Worker | null = null
  let generation = 0, disposed = false, foreground = true, resumeOnKill = false, persistedAt = 0
  function persist() {
    if (!task) return
    task.progress = { ...progress.value }; persistedAt = Date.now()
    try { wx.setStorageSync(key, { ...task, resourceRevision: resourceRevision() }) }
    catch { notice.value = '存储空间不足，请保持小程序在前台完成计算' }
  }
  function stop(clear = true) {
    generation++; worker?.terminate(); worker = null; busy.value = false
    if (clear) { task = null; resumeOnKill = false; try { wx.removeStorageSync(key) } catch {} }
  }
  function cancel() { stop(); notice.value = '已取消计算' }
  async function launch() {
    if (!task || worker || disposed || !foreground) return
    const snapshot = task, active = ++generation
    busy.value = true
    try {
      requireWorkerSupport()
      await new Promise<void>((resolve, reject) => wx.preDownloadSubpackage({ packageType: 'workers', success: () => resolve(), fail: reject }))
      if (active !== generation || disposed || !foreground) return
      const current = wx.createWorker('workers/baby.js', { useExperimentalWorker: true }); worker = current
      current.onError?.((event) => {
        if (worker !== current || active !== generation) return
        error.value = workerErrorMessage(event, '后台计算失败，请重新尝试')
        stop()
      })
      current.onMessage(event => {
        if (worker !== current || active !== generation) return
        const message = event as unknown as SplitMessage
        if (message.type === 'progress') progress.value = { completed: message.completed, total: message.total }
        else if (message.type === 'checkpoint') {
          snapshot.checkpoint = message.checkpoint
          progress.value = { completed: message.checkpoint.completed, total: snapshot.options.targets.length * 100 * (snapshot.options.sleepType === 'all' ? 4 : 1) }
          if (Date.now() - persistedAt >= 1000) persist()
        } else if (message.type === 'result') { result.value = message.result; notice.value = ''; stop() }
        else { error.value = message.message; stop() }
      })
      current.onProcessKilled(() => {
        if (worker !== current) return
        worker = null; generation++; persist()
        notice.value = '计算被微信中断，检查点已保存；返回前台后续算'
        if (foreground && resumeOnKill) { resumeOnKill = false; void launch() }
        else if (foreground) busy.value = false
      })
      current.postMessage(withResources({ splitOptions: snapshot.options, checkpoint: snapshot.checkpoint }))
    } catch (cause) {
      if (active === generation) { error.value = cause instanceof Error ? cause.message : '无法启动计算，请在真机或新版微信中重试'; stop(false) }
    }
  }
  async function calculate() {
    if (busy.value) return
    error.value = validateSplitOptions(options.value) ?? ''
    if (error.value) return
    stop(); notice.value = ''; progress.value = { completed: 0, total: 0 }
    task = { options: JSON.parse(JSON.stringify(options.value)), progress: { ...progress.value } }; persist()
    await launch()
  }
  const hide = () => { foreground = false; resumeOnKill = true; persist(); if (task) notice.value = '检查点已保存，返回前台后继续计算' }
  const show = () => { foreground = true; if (task && !worker) { resumeOnKill = false; void launch() } }
  wx.onAppHide?.(hide); wx.onAppShow?.(show)
  try {
    const saved = wx.getStorageSync(key) as SavedTask | undefined
    if (saved?.options && compatibleCheckpoint(saved) && !validateSplitOptions(saved.options) && JSON.stringify(saved.options) === JSON.stringify(options.value)) {
      task = saved; progress.value = saved.progress ?? { completed: 0, total: 0 }; notice.value = '正在恢复上次未完成的计算'; void launch()
    }
  } catch { /* Corrupt local records never block a new calculation. */ }
  onScopeDispose(() => { disposed = true; wx.offAppHide?.(hide); wx.offAppShow?.(show); stop() })
  return { busy, error, notice, progress, result, dirty, calculate, cancel }
}
