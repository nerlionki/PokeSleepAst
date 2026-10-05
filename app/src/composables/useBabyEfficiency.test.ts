import { effectScope, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_BABY_EFFICIENCY, type BabyEfficiencyResult } from '../calc/babyEfficiency'
import { useBabyEfficiency } from './useBabyEfficiency'

class FakeWorker {
  static instances: FakeWorker[] = []
  onmessage: ((event: { data: unknown }) => void) | null = null
  onerror: (() => void) | null = null
  postMessage = vi.fn()
  terminate = vi.fn()
  constructor() { FakeWorker.instances.push(this) }
  emit(data: unknown) { this.onmessage?.({ data }) }
}

afterEach(() => { vi.unstubAllGlobals(); FakeWorker.instances = [] })

describe('baby efficiency worker lifecycle', () => {
  it('cancels immediately, ignores stale worker messages and disposes on navigation', () => {
    vi.stubGlobal('Worker', FakeWorker)
    const scope = effectScope()
    const options = ref({ ...DEFAULT_BABY_EFFICIENCY })
    const task = scope.run(() => useBabyEfficiency(options))!
    task.calculate()
    task.calculate()
    expect(FakeWorker.instances).toHaveLength(1)
    const old = FakeWorker.instances[0]!
    old.emit({ type: 'progress', progress: { percent: 20, island: '测试岛', evaluatedStates: 5 } })
    expect(task.progress.value.percent).toBe(20)
    task.cancel()
    expect(old.terminate).toHaveBeenCalledOnce()
    expect(task.busy.value).toBe(false)
    const result: BabyEfficiencyResult = { options: { ...options.value }, catch: { value: 1, intervals: [] }, candy: { value: 4, intervals: [] }, evaluatedStates: 5 }
    task.calculate()
    old.emit({ type: 'result', result })
    expect(task.result.value).toBeNull()
    FakeWorker.instances[1]!.emit({ type: 'result', result })
    expect(task.result.value).toEqual(result)
    options.value.eventMix = true
    expect(task.dirty.value).toBe(true)
    task.calculate()
    scope.stop()
    expect(FakeWorker.instances[2]!.terminate).toHaveBeenCalledOnce()
  })

  it('validates before creating a worker and recovers from worker errors', () => {
    vi.stubGlobal('Worker', FakeWorker)
    const scope = effectScope()
    const options = ref({ ...DEFAULT_BABY_EFFICIENCY, iterations: 0 })
    const task = scope.run(() => useBabyEfficiency(options))!
    task.calculate()
    expect(task.error.value).toMatch(/次数/)
    expect(FakeWorker.instances).toHaveLength(0)
    options.value.iterations = 4000
    task.calculate()
    FakeWorker.instances[0]!.onerror?.()
    expect(task.busy.value).toBe(false)
    expect(task.error.value).toMatch(/失败/)
    scope.stop()
  })
})
