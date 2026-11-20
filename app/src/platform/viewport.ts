import { onMounted, onScopeDispose, shallowRef } from 'vue'
import type { ViewportSize } from '../../../core/src/ui/responsive'

function measure(): ViewportSize {
  const visible = window.visualViewport
  return {
    width: document.documentElement.clientWidth,
    height: window.innerHeight,
    visibleHeight: visible?.height ?? window.innerHeight,
    visibleTop: visible?.offsetTop ?? 0,
    safeLeft: 0,
    safeRight: 0,
    safeBottom: 0,
  }
}

const viewport = shallowRef(measure())
let subscribers = 0
let frame = 0
function refresh() {
  cancelAnimationFrame(frame)
  frame = requestAnimationFrame(() => { viewport.value = measure() })
}

export function useViewport() {
  let mounted = false
  onMounted(() => {
    mounted = true
    if (subscribers++ === 0) {
      window.addEventListener('resize', refresh)
      window.visualViewport?.addEventListener('resize', refresh)
      window.visualViewport?.addEventListener('scroll', refresh)
    }
    refresh()
  })
  onScopeDispose(() => {
    if (!mounted || --subscribers > 0) return
    cancelAnimationFrame(frame)
    window.removeEventListener('resize', refresh)
    window.visualViewport?.removeEventListener('resize', refresh)
    window.visualViewport?.removeEventListener('scroll', refresh)
  })
  return viewport
}
