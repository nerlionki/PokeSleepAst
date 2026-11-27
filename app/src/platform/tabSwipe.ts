import type { Ref } from 'vue'
import { createTabSwipe, type SwipeEvent } from '../../../core/src/composables/useTabSwipe'

interface SwipeElement {
  tagName?: string
  nodeName?: string
  type?: string
  getAttribute?: (name: string) => string | null
  dataset?: { swipeIgnore?: unknown }
  parentElement?: SwipeElement | null
  scrollWidth?: number
  clientWidth?: number
}

function isInteractive({ target, currentTarget }: SwipeEvent) {
  let element = target as SwipeElement | undefined | null
  while (element) {
    if (/^(input|textarea|select)$/i.test(element.tagName ?? element.nodeName ?? '')
      || /^(range|slider)$/i.test(element.type ?? '')
      || element.getAttribute?.('role') === 'slider'
      || element.dataset?.swipeIgnore != null
      || (typeof getComputedStyle === 'function'
        && (element.scrollWidth ?? 0) > (element.clientWidth ?? Infinity) + 2
        && /^(auto|scroll)$/.test(getComputedStyle(element as Element).overflowX))) return true
    if (element === currentTarget) break
    element = element.parentElement
  }
  return false
}

export function useTabSwipe<T extends string>(model: Ref<T>, available: () => readonly T[], disabled?: () => boolean) {
  return createTabSwipe(model, available, isInteractive, disabled)
}
