
import clientDefaults from '../data/client-defaults.resource'
import { cloneData } from '../calc/dataClone'
import { computed, onScopeDispose, shallowRef } from 'vue'
import { scoreFingerprint } from '../calc/scoreSearch'
import type { ScoreMessage, ScoreRequest, ScoreResult } from '../calc/scorePlan'
const composables_scorePlanTask_config_clientDefaults = clientDefaults.modules.composables_scorePlanTask

export interface PlanningWorker<Request, Message> {
  onmessage: ((event: { data: Message }) => void) | null
  onerror: ((error?: unknown) => void) | null
  postMessage(request: Request): void
  terminate(): void
}
export type ScoreWorker = PlanningWorker<ScoreRequest, ScoreMessage>
type PlanningMessage<Result> = { type: 'progress'; completed: number; total: number }
  | { type: 'result'; result: Result } | { type: 'error'; message: string } | { type: 'checkpoint' }

export function createScorePlanTask(createWorker: (notice: (message: string) => void) => ScoreWorker | Promise<ScoreWorker>,
  currentInput: () => ScoreRequest) {
  return createPlanningTask<ScoreRequest, ScoreResult, ScoreMessage>(createWorker, currentInput, scoreFingerprint)
}

export function createPlanningTask<Request, Result, Message extends PlanningMessage<Result>>(
  createWorker: (notice: (message: string) => void) => PlanningWorker<Request, Message> | Promise<PlanningWorker<Request, Message>>,
  currentInput: () => Request, fingerprint: (request: Request) => string = JSON.stringify,
) {
  const busy = shallowRef(composables_scorePlanTask_config_clientDefaults["busyInitial"]), error = shallowRef(composables_scorePlanTask_config_clientDefaults["errorInitial"]), notice = shallowRef(composables_scorePlanTask_config_clientDefaults["noticeInitial"])
  const result = shallowRef<Result | null>((composables_scorePlanTask_config_clientDefaults["resultInitial"] as unknown as Result | null)), progress = shallowRef(cloneData(composables_scorePlanTask_config_clientDefaults["progressInitial"]))
  let worker: PlanningWorker<Request, Message> | null = null, generation = composables_scorePlanTask_config_clientDefaults["generation"], lastFingerprint = composables_scorePlanTask_config_clientDefaults["lastFingerprint"]
  const dirty = computed(() => Boolean(result.value && lastFingerprint !== fingerprint(currentInput())))
  function stop() { generation++; worker?.terminate(); worker = null; busy.value = false }
  function cancel() { stop(); notice.value = '已取消规划' }
  async function calculate(restored?: Request) {
    if (busy.value) return
    const snapshot: Request = JSON.parse(JSON.stringify(restored ?? currentInput()))
    const active = ++generation
    lastFingerprint = fingerprint(snapshot)
    busy.value = true; error.value = ''; notice.value = ''; result.value = null; progress.value = { completed: 0, total: 1 }
    try {
      const current = await createWorker(message => { if (active === generation) notice.value = message })
      if (active !== generation) { current.terminate(); return }
      worker = current
      current.onmessage = ({ data }) => {
        if (worker !== current || generation !== active) return
        if (data.type === 'progress') progress.value = { completed: data.completed, total: data.total }
        else if (data.type === 'result') { result.value = data.result; stop() }
        else if (data.type === 'error') { error.value = data.message; stop() }
      }
      current.onerror = () => { if (worker === current) { error.value = '规划中断，请重新规划'; stop() } }
      current.postMessage(snapshot)
    } catch (cause) { if (active === generation) { error.value = cause instanceof Error ? cause.message : '无法启动规划'; stop() } }
  }
  onScopeDispose(stop)
  return { busy, error, notice, result, progress, dirty, calculate, cancel }
}
