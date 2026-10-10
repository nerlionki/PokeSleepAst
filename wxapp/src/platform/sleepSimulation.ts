import { createSleepSimulationTask, type SleepSimulationWorker } from '../../../core/src/composables/sleepSimulationTask'
import type { SleepSimulationCheckpoint, SleepSimulationMessage, SleepSimulationRequest } from '../../../core/src/calc/sleepSimulation'
import { requireWorkerSupport } from './compatibility'
const STORAGE_KEY = 'sleep-simulation-checkpoint-v1'
export function useSleepSimulation() {
  const state = createSleepSimulationTask(async (isActive) => {
    requireWorkerSupport()
    await new Promise<void>((resolve, reject) => wx.preDownloadSubpackage({ packageType: 'workers', success: () => resolve(), fail: () => reject(new Error('后台模拟资源下载失败，请检查网络后重试')) }))
    if (!isActive()) throw new Error('模拟已取消')
    let worker: WechatMiniprogram.Worker | null = null, request: SleepSimulationRequest | null = null
    let checkpoint: SleepSimulationCheckpoint | undefined, disposed = false, foreground = true, resumeOnKill = false
    let onMessage: (message: SleepSimulationMessage) => void = () => {}
    const persist = () => {
      if (!request) return
      try { wx.setStorageSync?.(STORAGE_KEY, { ...request, checkpoint }) }
      catch { state.notice.value = '存储空间不足，请保持小程序在前台完成模拟' }
    }
    const start = () => {
      if (disposed || !isActive() || worker) return
      const current = wx.createWorker('workers/sleep.js', { useExperimentalWorker: true }); worker = current
      current.onMessage((event) => {
        if (worker !== current || disposed) return
        const message = event as unknown as SleepSimulationMessage
        if (message.type === 'checkpoint') { checkpoint = message.checkpoint; persist() }
        else onMessage(message)
      })
      current.onProcessKilled(() => {
        if (worker !== current || disposed) return
        worker = null; persist(); state.notice.value = '模拟被微信中断，返回前台后自动续算'
        if (foreground && resumeOnKill) {
          resumeOnKill = false
          try { start() } catch { onMessage({ type: 'error', message: '无法恢复模拟，请重新计算' }) }
        }
      })
      if (request) current.postMessage({ ...request, checkpoint })
    }
    const hide = () => { foreground = false; resumeOnKill = true; persist(); state.notice.value = request ? '微信可能暂停模拟，返回前台后自动续算' : '' }
    const show = () => {
      foreground = true
      if (request && !worker && !disposed) {
        resumeOnKill = false
        state.notice.value = '正在从已保存的检查点续算'
        try { start() } catch { onMessage({ type: 'error', message: '无法恢复模拟，请重新计算' }) }
      }
    }
    wx.onAppHide?.(hide); wx.onAppShow?.(show)
    start()
    const adapter: SleepSimulationWorker = {
      onMessage(callback) { onMessage = callback }, onError() { /* Process termination is recovered on app show. */ },
      postMessage(value) { request = value; checkpoint = value.checkpoint; persist(); worker?.postMessage({ ...value, checkpoint }) },
      terminate() {
        if (disposed) return
        disposed = true; worker?.terminate(); worker = null
        wx.offAppHide?.(hide); wx.offAppShow?.(show)
        try { wx.removeStorageSync?.(STORAGE_KEY) } catch {}
      },
    }
    return adapter
  })
  try {
    const saved = wx.getStorageSync?.(STORAGE_KEY) as SleepSimulationRequest | undefined
    if (saved?.powers?.length && Number.isInteger(saved.iterations) && saved.iterations > 0 && saved.iterations <= 100000) {
      void state.calculate(saved); state.notice.value = '正在恢复上次未完成的模拟'
    }
  } catch { /* Ignore corrupt storage; new calculations remain available. */ }
  return state
}
