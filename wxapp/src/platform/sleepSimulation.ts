import { createSleepSimulationTask } from '../../../core/src/composables/sleepSimulationTask'
import { requireWorkerSupport } from './compatibility'
export function useSleepSimulation() {
  return createSleepSimulationTask(async (isActive) => {
    requireWorkerSupport()
    await new Promise<void>((resolve, reject) => wx.preDownloadSubpackage({ packageType: 'workers', success: () => resolve(), fail: () => reject(new Error('后台模拟资源下载失败，请检查网络后重试')) }))
    if (!isActive()) throw new Error('模拟已取消')
    const worker = wx.createWorker('workers/sleep.js', { useExperimentalWorker: true })
    return { onMessage: (callback) => worker.onMessage((message) => callback(message as unknown as Parameters<typeof callback>[0])),
      onError: (callback) => worker.onProcessKilled(callback), postMessage: (request) => worker.postMessage(request), terminate: () => worker.terminate() }
  })
}
