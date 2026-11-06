import { onMounted, onScopeDispose } from 'vue'
import type { GuideMeasure } from '../../../core/src/ui/guideLayout'

export async function measureGuide(selectors: readonly string[], reveal = false): Promise<GuideMeasure> {
  const element = selectors.map(selector => document.querySelector(selector)).find(Boolean)
  if (reveal && element) {
    const rect = element.getBoundingClientRect()
    if (rect.top < 0 || rect.bottom > innerHeight) element.scrollIntoView({ block: 'center', behavior: 'instant' })
  }
  const rect = element?.getBoundingClientRect()
  const content = document.querySelector('#guide-tour-content')?.getBoundingClientRect()
  return { width: innerWidth, height: innerHeight, target: rect && { left: rect.left, top: rect.top, width: rect.width, height: rect.height }, contentHeight: content?.height }
}

export function useGuideAnchorChanges(refresh: () => void) {
  let frame = 0
  function schedule() { cancelAnimationFrame(frame); frame = requestAnimationFrame(refresh) }
  onMounted(() => { window.addEventListener('resize', schedule); document.addEventListener('scroll', schedule, true) })
  onScopeDispose(() => { cancelAnimationFrame(frame); window.removeEventListener('resize', schedule); document.removeEventListener('scroll', schedule, true) })
}
