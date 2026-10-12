import { computed, onScopeDispose, shallowRef, watch, type Ref } from 'vue'
interface TaskLock { back?: () => void }
const locks = shallowRef<Map<symbol, TaskLock>>(new Map())
export const taskNavigationLocked = computed(() => locks.value.size > 0)
export function acquireTaskNavigationLock(back?: () => void) {
  const token = Symbol('task')
  locks.value = new Map(locks.value).set(token, { back })
  return () => {
    if (!locks.value.has(token)) return
    const next = new Map(locks.value); next.delete(token); locks.value = next
  }
}
export function handleTaskNavigationBack(): boolean {
  if (!taskNavigationLocked.value) return false
  const active = [...locks.value.values()].at(-1)
  active?.back?.()
  return true
}
export function useTaskNavigationLock(busy: Ref<boolean>, back?: () => void) {
  let release: (() => void) | undefined
  const stop = watch(busy, value => {
    if (value && !release) release = acquireTaskNavigationLock(back)
    else if (!value) { release?.(); release = undefined }
  }, { immediate: true, flush: 'sync' })
  onScopeDispose(() => { stop(); release?.() })
}
