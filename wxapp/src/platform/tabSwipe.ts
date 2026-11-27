import type { Ref } from 'vue'
import { createTabSwipe, type SwipeEvent } from '../../../core/src/composables/useTabSwipe'

interface NativeTarget {
  tagName?: string
  nodeName?: string
  dataset?: { swipeIgnore?: unknown }
  parentElement?: NativeTarget | null
}

function isInteractive({ target, currentTarget }: SwipeEvent) {
  let element = target as NativeTarget | undefined | null
  while (element) {
    if (/^(input|textarea|picker|slider|switch)$/i.test(element.tagName ?? element.nodeName ?? '')
      || element.dataset?.swipeIgnore != null) return true
    if (element === currentTarget) break
    element = element.parentElement
  }
  return false
}

export function useTabSwipe<T extends string>(model: Ref<T>, available: () => readonly T[], disabled?: () => boolean) {
  return createTabSwipe(model, available, isInteractive, disabled)
}
