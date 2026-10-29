import { withResources, resourceRevision, compatibleCheckpoint } from '../../../core/src/resources/runtime'
import { createScorePlanTask, type ScoreWorker } from '../../../core/src/composables/scorePlanTask'
import { scoreFingerprint } from '../../../core/src/calc/scoreSearch'
import type { ScoreCheckpoint, ScoreMessage, ScoreRequest } from '../../../core/src/calc/scorePlan'
import { requireWorkerSupport } from './compatibility'
const KEY = 'score-plan-checkpoint-v1'
export function useScorePlan(currentInput: () => ScoreRequest) {
  const task = createScorePlanTask(async notice => {
    requireWorkerSupport()
    await new Promise<void>((resolve, reject) => wx.preDownloadSubpackage({ packageType: 'workers', success: () => resolve(), fail: () => reject(new Error('规划资源下载失败，请检查网络')) }))
    let worker: WechatMiniprogram.Worker | null = null, request: ScoreRequest | null = null, checkpoint: ScoreCheckpoint | undefined
    let disposed = false, foreground = true
    const persist = () => { if (request) try { wx.setStorageSync(KEY, { ...request, checkpoint, resourceRevision: resourceRevision() }) } catch { notice('存储空间不足，请保持前台完成规划') } }
    const start = () => {
      if (disposed || worker || !request) return
      const current = wx.createWorker('workers/score.js', { useExperimentalWorker: true }); worker = current
      current.onMessage(event => {
        if (disposed || worker !== current) return
        const data = event as unknown as ScoreMessage
        if (data.type === 'checkpoint') { checkpoint = data.checkpoint; persist() }
        else adapter.onmessage?.({ data })
      })
      current.onProcessKilled(() => { if (worker === current && !disposed) { worker = null; persist(); notice('微信中断了规划，返回前台后续算') } })
      current.postMessage(withResources({ ...request, checkpoint }))
    }
    const hide = () => { foreground = false; persist(); notice('微信可能暂停后台计算，返回前台后续算') }
    const show = () => { foreground = true; if (!disposed && !worker) try { start() } catch { adapter.onerror?.() } }
    wx.onAppHide?.(hide); wx.onAppShow?.(show)
    const adapter: ScoreWorker = { onmessage: null, onerror: null,
      postMessage(value) { request = value; checkpoint = value.checkpoint; persist(); if (foreground) start() },
      terminate() { disposed = true; worker?.terminate(); worker = null; wx.offAppHide?.(hide); wx.offAppShow?.(show); try { wx.removeStorageSync(KEY) } catch {} },
    }
    return adapter
  }, currentInput)
  function restore() { try {
    const saved = wx.getStorageSync(KEY) as (ScoreRequest & { resourceRevision?: string }) | undefined
    if (saved?.checkpoint && compatibleCheckpoint(saved) && scoreFingerprint(saved) === scoreFingerprint(currentInput())) void task.calculate(saved)
  } catch { /* 损坏或过期的存档不影响重新规划。 */ } }
  return { ...task, restore }
}
