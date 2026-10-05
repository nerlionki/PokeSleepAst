import type { ObjectDirective } from 'vue'
import type { Router } from 'vue-router'

interface BackHandler { run: () => void; priority: () => number }

export function createBackStack() {
  const handlers: BackHandler[] = []
  return {
    add(run: () => void, priority: () => number = () => 20) {
      const handler = { run, priority }
      handlers.push(handler)
      return () => { const index = handlers.indexOf(handler); if (index >= 0) handlers.splice(index, 1) }
    },
    handle() {
      const top = [...handlers].reverse().sort((a, b) => b.priority() - a.priority())[0]
      if (!top) return false
      top.run()
      return true
    },
  }
}

export const backStack = createBackStack()
const registrations = new WeakMap<HTMLElement, { run: () => void; remove: () => void }>()
export const backDirective: ObjectDirective<HTMLElement, () => void> = {
  mounted(element, binding) {
    const handler = { run: binding.value, remove: () => {} }
    handler.remove = backStack.add(() => handler.run(), () => Number.parseInt(getComputedStyle(element).zIndex) || 20)
    registrations.set(element, handler)
  },
  updated(element, binding) { const handler = registrations.get(element); if (handler) handler.run = binding.value },
  beforeUnmount(element) { registrations.get(element)?.remove(); registrations.delete(element) },
}

export function installAndroidBack(router: Router, target: Pick<Window, 'addEventListener' | 'removeEventListener'> = window) {
  let navigating = false
  const stop = router.afterEach(() => { navigating = false })
  const onBack = () => {
    if (backStack.handle() || navigating) return
    const previous = router.options.history.state.back
    // Only move through app routes; never leave the WebView at the initial page.
    if (typeof previous === 'string' && router.resolve(previous).matched.length) {
      navigating = true
      router.back()
    }
  }
  target.addEventListener('appBackButton', onBack)
  return () => { stop(); target.removeEventListener('appBackButton', onBack) }
}
