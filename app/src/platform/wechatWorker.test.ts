import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'
import { useBabyEfficiency } from '../../../wxapp/src/platform/babyEfficiency'
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
