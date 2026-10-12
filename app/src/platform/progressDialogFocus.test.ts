import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, shallowRef } from 'vue'
import { useProgressDialogFocus } from './progressDialogFocus'

const scopes: ReturnType<typeof effectScope>[] = []
afterEach(() => { scopes.splice(0).forEach(scope => scope.stop()); vi.unstubAllGlobals() })
class FocusTarget { isConnected = true; focus = vi.fn() }
function environment() {
  const trigger = new FocusTarget(), panel = new FocusTarget(), style = { overflow: 'auto' }
  vi.stubGlobal('HTMLElement', FocusTarget)
  vi.stubGlobal('document', { activeElement: trigger, body: { style } })
  return { trigger, panel, style }
}
function mount(open: ReturnType<typeof shallowRef<boolean>>, panel: FocusTarget) {
  const scope = effectScope(); scopes.push(scope)
  scope.run(() => useProgressDialogFocus(open, () => panel))
  return scope
}
describe('progress dialog browser focus', () => {
  it('focuses the dialog and restores scroll/focus on completion', async () => {
    const { trigger, panel, style } = environment(), open = shallowRef(true)
    mount(open, panel)
    await nextTick()
    expect(style.overflow).toBe('hidden')
    expect(panel.focus).toHaveBeenCalledOnce()
    open.value = false; await nextTick(); await nextTick()
    expect(style.overflow).toBe('auto')
    expect(trigger.focus).toHaveBeenCalledOnce()
  })
  it('keeps scrolling locked for overlapping dialogs and cleans up on unmount', async () => {
    const { panel, style } = environment(), first = shallowRef(true), second = shallowRef(true)
    mount(first, panel); const secondScope = mount(second, panel)
    await nextTick()
    first.value = false; await nextTick()
    expect(style.overflow).toBe('hidden')
    secondScope.stop()
    expect(style.overflow).toBe('auto')
  })
})
