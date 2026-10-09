import { effectScope, reactive } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { createSleepSimulationTask, type SleepSimulationWorker } from '../../../core/src/composables/sleepSimulationTask'
import type { SleepSimulationMessage, SleepSimulationRequest } from '../../../core/src/calc/sleepSimulation'
const request: SleepSimulationRequest = { island: 'greengrass', sleepType: '淺淺入夢', powers: [1e7], iterations: 4000, seed: 1, options: { discovered: [] } }
function fakeWorker() {
  let message: (message: SleepSimulationMessage) => void = () => {}, error = () => {}
  return { onMessage(callback: typeof message) { message = callback }, onError(callback: typeof error) { error = callback },
    postMessage: vi.fn(), terminate: vi.fn(), emit: (event: SleepSimulationMessage) => message(event), fail: () => error() }
}
describe('sleep simulation task lifecycle', () => {
  it('dispatches once, accepts progress, cancels and ignores obsolete results', async () => {
    const worker = fakeWorker(), create = vi.fn(() => worker), scope = effectScope()
    const state = scope.run(() => createSleepSimulationTask(create))!
    const pending = state.calculate(request)
    expect(state.busy.value).toBe(true)
    await state.calculate(request); await pending
    expect(create).toHaveBeenCalledTimes(1)
    worker.emit({ type: 'progress', completed: 1000, total: 4000 })
    expect(state.progress.value.completed).toBe(1000)
    state.cancel()
    worker.emit({ type: 'result', result: [] })
    expect(state.notice.value).toBe('已取消模拟')
    expect(worker.terminate).toHaveBeenCalledTimes(1)
    expect(state.busy.value).toBe(false)
    scope.stop()
  })
  it('invalidates pending creation and disposes a worker that arrives after cancellation', async () => {
    const worker = fakeWorker(), scope = effectScope()
    let resolve!: (worker: SleepSimulationWorker) => void
    const state = scope.run(() => createSleepSimulationTask(() => new Promise((done) => { resolve = done })))!
    const pending = state.calculate(request)
    scope.stop(); resolve(worker); await pending
    expect(worker.postMessage).not.toHaveBeenCalled()
    expect(worker.terminate).toHaveBeenCalledTimes(1)
  })
  it('sends an immutable plain snapshot and resets when parameters change', async () => {
    const worker = fakeWorker(), scope = effectScope()
    const state = scope.run(() => createSleepSimulationTask(() => worker))!
    const input = reactive({ ...request, powers: [1e7], options: { discovered: ['1-1'] } })
    const pending = state.calculate(input)
    input.powers[0] = 9; input.options.discovered.push('2-1'); await pending
    expect(worker.postMessage.mock.calls[0]![0]).toMatchObject({ powers: [1e7], options: { discovered: ['1-1'] } })
    state.reset(); worker.emit({ type: 'progress', completed: 2000, total: 4000 })
    expect(state.progress.value).toEqual({ completed: 0, total: 0 })
    expect(state.result.value).toEqual([])
    scope.stop()
  })
  it('recovers from worker errors and allows another run', async () => {
    const worker = fakeWorker(), scope = effectScope()
    const state = scope.run(() => createSleepSimulationTask(() => worker))!
    await state.calculate(request); worker.fail()
    expect(state.error.value).toContain('中断')
    await state.calculate(request)
    worker.emit({ type: 'result', result: [] })
    expect(state.busy.value).toBe(false)
    scope.stop()
  })
})
