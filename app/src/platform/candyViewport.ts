import { onMounted, onScopeDispose, shallowRef, watch } from 'vue'
import { useViewport } from './viewport'

/** Header and tab bar include the active safe-area insets. Measure their real
 * heights so the pinned toolbar stays below a notch and above bottom controls. */
export function useCandyViewport() {
  const viewport = useViewport()
  const style = shallowRef<Record<string, string>>({})
  let observer: ResizeObserver | undefined
  function measure() {
    const header = document.querySelector('.app-shell > .topbar')
    const nav = document.querySelector('.app-shell > .tabbar')
    const page = document.querySelector('.app-shell > .page')
    const top = header?.getBoundingClientRect().height ?? 0
    const bottom = nav?.getBoundingClientRect().height ?? 0
    const padding = page ? Number.parseFloat(getComputedStyle(page).paddingBottom) || 0 : 0
    const height = viewport.value.visibleHeight
    style.value = { '--candy-sticky-top': `${top}px`, '--candy-frame-height': `${Math.max(1, height - top - bottom - padding)}px` }
  }
  onMounted(() => {
    measure()
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(measure)
      for (const selector of ['.app-shell > .topbar', '.app-shell > .tabbar', '.app-shell > .page']) {
        const node = document.querySelector(selector)
        if (node) observer.observe(node)
      }
    }
  })
  watch(viewport, measure, { flush: 'post' })
  onScopeDispose(() => {
    observer?.disconnect()
  })
  return style
}
