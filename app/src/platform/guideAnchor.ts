import { onMounted, onScopeDispose, watch } from 'vue'
import { useViewport } from './viewport'
import type { GuideMeasure } from '../../../core/src/ui/guideLayout'

export async function measureGuide(selectors: readonly string[], reveal = false): Promise<GuideMeasure> {
  const visible = window.visualViewport
  const element = selectors.map(selector => document.querySelector(selector)).find(Boolean)
  if (reveal && element) {
    const rect = element.getBoundingClientRect()
    const top = visible?.offsetTop ?? 0
    if (rect.top < top || rect.bottom > top + (visible?.height ?? innerHeight)) element.scrollIntoView({ block: 'center', behavior: 'instant' })
  }
  const rect = element?.getBoundingClientRect()
  const content = document.querySelector('#guide-tour-content')?.getBoundingClientRect()
  return { width: document.documentElement.clientWidth, height: visible?.height ?? innerHeight,
    target: rect && { left: rect.left, top: rect.top - (visible?.offsetTop ?? 0), width: rect.width, height: rect.height }, contentHeight: content?.height }
}

export function useGuideAnchorChanges(refresh: () => void) {
  const viewport = useViewport()
  let frame = 0
  function schedule() { cancelAnimationFrame(frame); frame = requestAnimationFrame(refresh) }
  watch(viewport, schedule, { flush: 'post' })
  onMounted(() => { document.addEventListener('scroll', schedule, true) })
  onScopeDispose(() => { cancelAnimationFrame(frame); document.removeEventListener('scroll', schedule, true) })
}
