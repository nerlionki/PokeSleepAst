import { shallowReactive, type ObjectDirective } from 'vue'
import { route } from './router'

export const pageScrollLocks = shallowReactive(new Map<string, number>())
const owners = new WeakMap<object, string>()

export const modalScrollLock: ObjectDirective<object, (() => void) | undefined> = {
  mounted(element, binding) {
    if (!binding.value) return
    const page = route.name
    owners.set(element, page)
    pageScrollLocks.set(page, (pageScrollLocks.get(page) ?? 0) + 1)
  },
  beforeUnmount(element) {
    const page = owners.get(element)
    if (!page) return
    owners.delete(element)
    const count = pageScrollLocks.get(page) ?? 0
    if (count <= 1) pageScrollLocks.delete(page)
    else pageScrollLocks.set(page, count - 1)
  },
}
