import { describe, expect, it, vi } from 'vitest'
import type { Router } from 'vue-router'
import { backStack, createBackStack, installAndroidBack } from './back'

describe('app back navigation', () => {
  it('closes the top overlay first, respects stacking priority, and removes unmounted handlers', () => {
    const stack = createBackStack()
    const editor = vi.fn(), picker = vi.fn(), update = vi.fn()
    const removeEditor = stack.add(editor)
    const removeUpdate = stack.add(update, () => 60)
    const removePicker = stack.add(picker, () => 30)
    expect(stack.handle()).toBe(true)
    expect(update).toHaveBeenCalledOnce()
    removeUpdate()
    stack.handle()
    expect(picker).toHaveBeenCalledOnce()
    removePicker()
    stack.handle()
    expect(editor).toHaveBeenCalledOnce()
    removeEditor()
    expect(stack.handle()).toBe(false)
  })
  it('closes the most recently opened overlay at the same stacking level', () => {
    const stack = createBackStack()
    const outer = vi.fn(), inner = vi.fn()
    stack.add(outer)
    stack.add(inner)
    stack.handle()
    expect(inner).toHaveBeenCalledOnce()
    expect(outer).not.toHaveBeenCalled()
  })
  it('uses app route history only, absorbs root back, and suppresses rapid duplicate navigation', () => {
    const target = new EventTarget()
    const state: { back: string | null } = { back: null }
    let afterEach = () => {}
    const stop = vi.fn()
    const router = { options: { history: { state } }, back: vi.fn(),
      resolve: (path: string) => ({ matched: path.startsWith('/pokemon') ? [{}] : [] }),
      afterEach: (handler: () => void) => { afterEach = handler; return stop },
    } as unknown as Router
    const cleanup = installAndroidBack(router, target)
    const gesture = () => target.dispatchEvent(new Event('appBackButton'))
    gesture()
    expect(router.back).not.toHaveBeenCalled()
    state.back = '/pokemon?tab=box'
    const close = vi.fn()
    const remove = backStack.add(close)
    gesture()
    expect(close).toHaveBeenCalledOnce()
    expect(router.back).not.toHaveBeenCalled()
    remove()
    gesture()
    gesture()
    expect(router.back).toHaveBeenCalledOnce()
    afterEach()
    state.back = 'https://outside.test'
    gesture()
    expect(router.back).toHaveBeenCalledOnce()
    cleanup()
    state.back = '/pokemon'
    gesture()
    expect(router.back).toHaveBeenCalledOnce()
    expect(stop).toHaveBeenCalledOnce()
  })
})
