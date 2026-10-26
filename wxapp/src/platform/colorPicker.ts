import { onBeforeUnmount } from 'vue'
import Taro from '@tarojs/taro'
import { colorPlanePosition } from '../../../core/src/ui/color'
import type { ColorPlaneKind, ColorPlanePosition, ColorPlaneRect } from '../../../core/src/ui/color'

interface TouchPoint { clientX: number; clientY: number }
interface ColorTouchEvent { touches?: ArrayLike<TouchPoint>; changedTouches?: ArrayLike<TouchPoint> }
export function useColorPickerDrag(change: (kind: ColorPlaneKind, point: ColorPlanePosition) => void) {
  let generation = 0
  let active: { token: number; kind: ColorPlaneKind; point: TouchPoint; rect?: ColorPlaneRect; ended?: boolean } | undefined
  function apply() {
    if (!active?.rect) return
    const position = colorPlanePosition(active.rect, active.point)
    if (position) change(active.kind, position)
  }
  function touchStart(kind: ColorPlaneKind, selector: string, event: ColorTouchEvent) {
    const point = event.touches?.[0]
    if (!point) return
    const token = ++generation
    active = { token, kind, point }
    // Native queries and touch points both use viewport coordinates, including after scrolling.
    Taro.createSelectorQuery().select(selector).boundingClientRect(rect => {
      if (active?.token !== token || !rect || Array.isArray(rect)) return
      active.rect = rect
      apply()
      if (active?.token === token && active.ended) active = undefined
    }).exec()
  }
  function touchMove(event: ColorTouchEvent) {
    const point = event.touches?.[0] ?? event.changedTouches?.[0]
    if (!active || !point) return
    active.point = point
    apply()
  }
  function touchEnd(event: ColorTouchEvent) {
    touchMove(event)
    if (active) active.ended = true
    // Retain the final point until an outstanding native layout query completes.
    if (active?.rect) active = undefined
  }
  function cancel() { generation++; active = undefined }
  onBeforeUnmount(cancel)
  return { touchStart, touchMove, touchEnd, cancel, pointerDown: (_kind: ColorPlaneKind, _selector: string, _event: unknown) => {}, pointerMove: (_event: unknown) => {}, pointerEnd: (_event: unknown) => {} }
}
