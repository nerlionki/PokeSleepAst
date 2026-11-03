import { onMounted, shallowRef, watch } from 'vue'
import { loadJson, saveJson } from '../storage'

/** Persist a local toggle without replacing edits made during async restoration. */
export function useStoredBoolean(key: string, initial = true) {
  const state = shallowRef(initial), ready = shallowRef(false), error = shallowRef('')
  let edited = false
  let writes = Promise.resolve()
  const persist = (value: boolean) => {
    writes = writes.then(() => saveJson(key, value)).then(() => { error.value = '' }, cause => {
      error.value = cause instanceof Error ? cause.message : '设置保存失败'
    })
  }
  watch(state, value => {
    if (!ready.value) { edited = true; return }
    persist(value)
  }, { flush: 'sync' })
  onMounted(async () => {
    try {
      const saved = await loadJson<unknown>(key, initial)
      const changedWhileLoading = edited
      if (!changedWhileLoading) state.value = saved !== false
      ready.value = true
      if (changedWhileLoading) persist(state.value)
    } catch (cause) {
      // Leave unreadable saved data untouched; the caller can surface the error.
      error.value = cause instanceof Error ? cause.message : '设置读取失败'
    }
  })
  return { state, ready, error }
}
