import { onScopeDispose, shallowRef } from 'vue'
import type { SleepSimulationMessage, SleepSimulationRequest, SleepSimulationRows } from '../calc/sleepSimulation'
export interface SleepSimulationWorker {
  onMessage(callback: (message: SleepSimulationMessage) => void): void
  onError(callback: () => void): void
  postMessage(request: SleepSimulationRequest): void
  terminate(): void
}
export function createSleepSimulationTask(createWorker: (isActive: () => boolean) => SleepSimulationWorker | Promise<SleepSimulationWorker>) {
  const busy = shallowRef(false), error = shallowRef(''), notice = shallowRef('')
  const progress = shallowRef({ completed: 0, total: 0 })
  const result = shallowRef<SleepSimulationRows>([])
  let worker: SleepSimulationWorker | null = null, generation = 0
  function stop() { generation++; worker?.terminate(); worker = null; busy.value = false }
  function cancel() { stop(); notice.value = '已取消模拟' }
  function reset() { stop(); result.value = []; error.value = ''; notice.value = ''; progress.value = { completed: 0, total: 0 } }
  async function calculate(request: SleepSimulationRequest) {
    if (busy.value) return
    const snapshot = { ...request, powers: [...request.powers], options: { ...request.options, discovered: [...(request.options.discovered ?? [])] } }
    const active = ++generation
    busy.value = true; result.value = []; error.value = ''; notice.value = ''
    progress.value = { completed: 0, total: snapshot.iterations * snapshot.powers.length }
    try {
      const current = await createWorker(() => active === generation)
      if (active !== generation) { current.terminate(); return }
      worker = current
      current.onMessage((message) => {
        if (worker !== current || active !== generation) return
        if (message.type === 'progress') progress.value = { completed: message.completed, total: message.total }
        else if (message.type === 'result') { result.value = message.result; stop() }
        else { error.value = message.message; stop() }
      })
      current.onError(() => { if (worker === current) { error.value = '后台模拟中断，请重试'; stop() } })
      current.postMessage(snapshot)
    } catch (cause) {
      if (active === generation) { error.value = cause instanceof Error ? cause.message : '无法启动后台模拟，请重试'; stop() }
    }
  }
  onScopeDispose(stop)
  return { busy, error, notice, progress, result, calculate, cancel, reset }
}
