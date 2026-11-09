import { nextTick, watch, type Ref } from 'vue'
import { lockPageScroll } from './pageScrollLock'

/** Browser focus/scroll behavior is kept out of the shared and native templates. */
export function useProgressDialogFocus(open: Readonly<Ref<boolean>>, target: () => unknown) {
  function focus() {
    const element = target()
    if (typeof HTMLElement !== 'undefined' && element instanceof HTMLElement) element.focus({ preventScroll: true })
  }
  watch(open, async (value, _previous, onCleanup) => {
    if (!value || typeof document === 'undefined') return
    const previousFocus = document.activeElement
    const unlock = lockPageScroll()
    onCleanup(() => {
      unlock()
      void nextTick(() => {
        if (!open.value && previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true })
      })
    })
    await nextTick()
    if (open.value) focus()
  }, { immediate: true, flush: 'post' })
  return { focus }
}
