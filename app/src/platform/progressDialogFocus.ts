import { nextTick, watch, type Ref } from 'vue'

let scrollLocks = 0, previousOverflow = ''
/** Browser focus/scroll behavior is kept out of the shared and native templates. */
export function useProgressDialogFocus(open: Readonly<Ref<boolean>>, target: () => unknown) {
  function focus() {
    const element = target()
    if (typeof HTMLElement !== 'undefined' && element instanceof HTMLElement) element.focus({ preventScroll: true })
  }
  watch(open, async (value, _previous, onCleanup) => {
    if (!value || typeof document === 'undefined') return
    const previousFocus = document.activeElement
    if (scrollLocks++ === 0) { previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden' }
    onCleanup(() => {
      if (--scrollLocks === 0) document.body.style.overflow = previousOverflow
      void nextTick(() => {
        if (!open.value && previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true })
      })
    })
    await nextTick()
    if (open.value) focus()
  }, { immediate: true, flush: 'post' })
  return { focus }
}
