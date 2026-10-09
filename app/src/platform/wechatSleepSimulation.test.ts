import { effectScope } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useSleepSimulation } from '../../../wxapp/src/platform/sleepSimulation'
import { requireWorkerSupport, versionAtLeast } from '../../../wxapp/src/platform/compatibility'
import type { SleepSimulationRequest } from '../../../core/src/calc/sleepSimulation'
const request: SleepSimulationRequest = { island: 'greengrass', sleepType: '淺淺入夢', powers: [1e7], iterations: 4000, seed: 1, options: {} }
afterEach(() => vi.unstubAllGlobals())
describe('WeChat background sleep simulation', () => {
  it('never creates a worker after cancellation during resource download', async () => {
    let downloaded = () => {}
    const createWorker = vi.fn()
    vi.stubGlobal('wx', { getAppBaseInfo: () => ({ SDKVersion: '2.27.3' }), createWorker,
      preDownloadSubpackage: ({ success }: { success: () => void }) => { downloaded = success } })
    const scope = effectScope(), state = scope.run(() => useSleepSimulation())!
    const pending = state.calculate(request)
    state.cancel(); downloaded(); await pending
    expect(createWorker).not.toHaveBeenCalled()
    expect(state.busy.value).toBe(false)
    scope.stop()
  })
  it('uses the native sleep worker, reports progress and terminates on completion', async () => {
    let message = (_event: unknown) => {}, killed = () => {}
    const worker = { onMessage(callback: typeof message) { message = callback }, onProcessKilled(callback: typeof killed) { killed = callback }, postMessage: vi.fn(), terminate: vi.fn() }
    const createWorker = vi.fn(() => worker)
    vi.stubGlobal('wx', { getAppBaseInfo: () => ({ SDKVersion: '3.14.3' }), createWorker,
      preDownloadSubpackage: ({ success }: { success: () => void }) => success() })
    const scope = effectScope(), state = scope.run(() => useSleepSimulation())!
    await state.calculate(request)
    expect(createWorker).toHaveBeenCalledWith('workers/sleep.js', { useExperimentalWorker: true })
    message({ type: 'progress', completed: 2000, total: 4000 })
    expect(state.progress.value.completed).toBe(2000)
    message({ type: 'result', result: [] })
    killed()
    expect(state.error.value).toBe('')
    expect(worker.terminate).toHaveBeenCalledTimes(1)
    scope.stop()
  })
  it('blocks unsupported libraries and old released mini-program versions before downloading', async () => {
    const download = vi.fn()
    vi.stubGlobal('wx', { getAppBaseInfo: () => ({ SDKVersion: '2.27.2' }), preDownloadSubpackage: download, createWorker: vi.fn() })
    const scope = effectScope(), state = scope.run(() => useSleepSimulation())!
    await state.calculate(request)
    expect(state.error.value).toContain('2.27.3')
    expect(download).not.toHaveBeenCalled()
    vi.stubGlobal('wx', { getAppBaseInfo: () => ({ SDKVersion: '3.14.3' }), getAccountInfoSync: () => ({ miniProgram: { version: '1.0.3', envVersion: 'release' } }) })
    expect(requireWorkerSupport).toThrow('1.0.4')
    scope.stop()
  })
  it('compares numeric components and permits development with no release version', () => {
    expect(versionAtLeast('2.27.10', '2.27.3')).toBe(true)
    expect(versionAtLeast('2.27.2', '2.27.3')).toBe(false)
    expect(versionAtLeast('', '2.27.3')).toBe(false)
    vi.stubGlobal('wx', { getAppBaseInfo: () => ({ SDKVersion: '2.27.3' }), getAccountInfoSync: () => ({ miniProgram: { version: '', envVersion: 'develop' } }), createWorker: vi.fn(), preDownloadSubpackage: vi.fn() })
    expect(requireWorkerSupport).not.toThrow()
  })
})
