import { onBeforeUnmount } from 'vue'
import { colorPlanePosition } from '../../../core/src/ui/color'
import type { ColorPlaneKind, ColorPlanePosition, ColorPlaneRect } from '../../../core/src/ui/color'

export function useColorPickerDrag(change: (kind: ColorPlaneKind, point: ColorPlanePosition) => void) {
  let active: { element: HTMLElement; id: number; kind: ColorPlaneKind; rect: ColorPlaneRect } | undefined
  function cancel() {
    const previous = active
    active = undefined
    if (previous?.element.hasPointerCapture(previous.id)) previous.element.releasePointerCapture(previous.id)
  }
  function pointerDown(kind: ColorPlaneKind, _selector: string, event: PointerEvent) {
    if (event.button !== 0 || !event.isPrimary) return
    cancel()
    const element = event.currentTarget as HTMLElement
    active = { element, id: event.pointerId, kind, rect: element.getBoundingClientRect() }
    element.setPointerCapture(event.pointerId)
    pointerMove(event)
  }
  function pointerMove(event: PointerEvent) {
    if (!active || active.id !== event.pointerId) return
    const position = colorPlanePosition(active.rect, event)
    if (position) change(active.kind, position)
  }
  function pointerEnd(event: PointerEvent) { if (active?.id !== event.pointerId) return; pointerMove(event); cancel() }
  onBeforeUnmount(cancel)
  return { pointerDown, pointerMove, pointerEnd, cancel, touchStart: (_kind: ColorPlaneKind, _selector: string, _event: unknown) => {}, touchMove: (_event: unknown) => {}, touchEnd: (_event: unknown) => {} }
}
