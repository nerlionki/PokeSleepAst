import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'
import { useBabyEfficiency } from '../../../wxapp/src/platform/babyEfficiency'
import { useSleepSimulation } from '../../../wxapp/src/platform/sleepSimulation'
import { DEFAULT_BABY_EFFICIENCY, type BabyEfficiencyOptions } from '../calc/babyEfficiency'
afterEach(() => vi.unstubAllGlobals())

describe('WeChat worker lifecycle', () => {
  it('does not start a worker when cancelled during subpackage loading', async () => {
    let loaded = () => {}
    const createWorker = vi.fn()
    vi.stubGlobal('wx', { getAppBaseInfo: () => ({ SDKVersion: '2.27.3' }), preDownloadSubpackage: ({ success }: { success: () => void }) => { loaded = success }, createWorker })
    const scope = effectScope()
    const state = scope.run(() => useBabyEfficiency(ref<BabyEfficiencyOptions>({ ...DEFAULT_BABY_EFFICIENCY })))!
    const pending = state.calculate()
    expect(state.busy.value).toBe(true)
    state.cancel(); loaded(); await pending
    expect(createWorker).not.toHaveBeenCalled()
    expect(state.notice.value).toBe('已取消计算')
    scope.stop()
  })

  it('terminates a running worker and ignores its late messages', async () => {
    let message: (event: unknown) => void = () => {}
    const worker = { onMessage: (callback: typeof message) => { message = callback }, onProcessKilled: vi.fn(), postMessage: vi.fn(), terminate: vi.fn() }
    vi.stubGlobal('wx', { getAppBaseInfo: () => ({ SDKVersion: '2.27.3' }), preDownloadSubpackage: ({ success }: { success: () => void }) => success(), createWorker: () => worker })
    const scope = effectScope()
    const state = scope.run(() => useBabyEfficiency(ref<BabyEfficiencyOptions>({ ...DEFAULT_BABY_EFFICIENCY })))!
    await state.calculate()
    expect(worker.postMessage).toHaveBeenCalledOnce()
    state.cancel(); message({ type: 'progress', progress: { percent: 95, island: 'late', evaluatedStates: 2 } })
    expect(worker.terminate).toHaveBeenCalledOnce()
    expect(state.progress.value.percent).toBe(0)
    scope.stop()
  })
})


it.each([['baby', 'before-show'], ['baby', 'after-show'], ['sleep', 'before-show'], ['sleep', 'after-show']] as const)('%s resumes a persisted checkpoint when the kill event arrives %s', async (kind, order) => {
  let hide = () => {}, show = () => {}
  const store: Record<string, unknown> = {}
  const workers: { emit: (message: unknown) => void, kill: () => void, postMessage: ReturnType<typeof vi.fn>, terminate: ReturnType<typeof vi.fn> }[] = []
  vi.stubGlobal('wx', { getAppBaseInfo: () => ({ SDKVersion: '2.27.3' }), preDownloadSubpackage: ({ success }: { success: () => void }) => success(),
    onAppHide: (callback: typeof hide) => { hide = callback }, onAppShow: (callback: typeof show) => { show = callback }, offAppHide: vi.fn(), offAppShow: vi.fn(),
    setStorageSync: (key: string, value: unknown) => { store[key] = JSON.parse(JSON.stringify(value)) }, getStorageSync: (key: string) => store[key], removeStorageSync: (key: string) => { delete store[key] },
    createWorker: () => {
      const worker = { emit: (_message: unknown) => {}, kill: () => {}, postMessage: vi.fn(), terminate: vi.fn(),
        onMessage(callback: (message: unknown) => void) { this.emit = callback }, onProcessKilled(callback: () => void) { this.kill = callback } }
      workers.push(worker); return worker
    },
  })
  const scope = effectScope(), state = scope.run(() => kind === 'baby' ? useBabyEfficiency(ref({ ...DEFAULT_BABY_EFFICIENCY })) : useSleepSimulation())!
  await state.calculate({ island: 'cyan', sleepType: '深深入眠', powers: [10000], iterations: 100, seed: 1, options: {} })
  const checkpoint = { version: 1, splitIndex: 2 }
  workers[0]!.emit({ type: 'checkpoint', checkpoint })
  hide()
  if (order === 'before-show') workers[0]!.kill()
  expect(workers).toHaveLength(1)
  show()
  if (order === 'after-show') workers[0]!.kill()
  await vi.waitFor(() => expect(workers).toHaveLength(2))
  expect(workers[1]!.postMessage.mock.calls[0]![0].checkpoint).toEqual(checkpoint)
  workers[0]!.emit({ type: 'error', message: 'stale' }); expect(state.error.value).toBe('')
  workers[1]!.kill(); await Promise.resolve()
  expect(workers).toHaveLength(2) // A foreground failure must not create a restart loop.
  state.cancel(); expect(Object.keys(store)).toHaveLength(0); scope.stop()
})
