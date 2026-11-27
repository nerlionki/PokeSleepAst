import type { Ref } from 'vue'
import { taskNavigationLocked } from './taskNavigationLock'

interface Point { clientX?: number; clientY?: number; pageX?: number; pageY?: number }
export interface SwipeEvent {
  touches?: ArrayLike<Point>
  changedTouches?: ArrayLike<Point>
  target?: unknown
  currentTarget?: unknown
}

export function swipeStep(dx: number, dy: number): number {
  return Math.abs(dx) >= 60 && Math.abs(dx) > Math.abs(dy) * 1.5 ? (dx < 0 ? 1 : -1) : 0
}

/** Bind only to a page's main tabs. Inner sections let gestures bubble here. */
export function createTabSwipe<T extends string>(
  model: Ref<T>,
  available: () => readonly T[],
  ignoreTarget: (event: SwipeEvent) => boolean,
  disabled: () => boolean = () => false
) {
  let start: { x: number; y: number; time: number } | undefined
  const point = (value?: Point) => value && { x: value.clientX ?? value.pageX ?? 0, y: value.clientY ?? value.pageY ?? 0 }
  function touchStart(event: SwipeEvent) {
    start = undefined
    if (taskNavigationLocked.value || disabled() || event.touches?.length !== 1 || ignoreTarget(event)) return
    const at = point(event.touches[0])
    if (at) start = { ...at, time: Date.now() }
  }
  function touchEnd(event: SwipeEvent) {
    const from = start
    start = undefined
    const to = point(event.changedTouches?.[0])
    if (!from || !to || Date.now() - from.time > 800 || taskNavigationLocked.value || disabled()) return
    const step = swipeStep(to.x - from.x, to.y - from.y)
    if (!step) return
    const tabs = available()
    const index = tabs.indexOf(model.value)
    const next = index >= 0 ? tabs[index + step] : undefined
    if (next != null) model.value = next
  }
  return { touchStart, touchEnd, touchCancel: () => { start = undefined } }
}
