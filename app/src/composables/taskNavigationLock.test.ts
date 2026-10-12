import { describe, expect, it, vi } from 'vitest'
import { effectScope, shallowRef } from 'vue'
import { acquireTaskNavigationLock, handleTaskNavigationBack, taskNavigationLocked, useTaskNavigationLock } from '../../../core/src/composables/taskNavigationLock'
describe('shared task navigation lock', () => {
  it('does not unlock another task and release is idempotent', () => {
    const first = acquireTaskNavigationLock(), second = acquireTaskNavigationLock()
    first(); first()
    expect(taskNavigationLocked.value).toBe(true)
    second()
    expect(taskNavigationLocked.value).toBe(false)
  })
  it('releases on success, failure, cancellation and scope disposal through busy state', () => {
    const scope = effectScope(), busy = shallowRef(false), cancel = vi.fn(() => { busy.value = false })
    scope.run(() => useTaskNavigationLock(busy, cancel))
    busy.value = true
    expect(taskNavigationLocked.value).toBe(true)
    expect(handleTaskNavigationBack()).toBe(true)
    expect(cancel).toHaveBeenCalledOnce()
    expect(taskNavigationLocked.value).toBe(false)
    busy.value = true; scope.stop()
    expect(taskNavigationLocked.value).toBe(false)
    expect(handleTaskNavigationBack()).toBe(false)
  })
  it('blocks Back for non-cancellable imports', () => {
    const release = acquireTaskNavigationLock()
    expect(handleTaskNavigationBack()).toBe(true)
    expect(taskNavigationLocked.value).toBe(true)
    release()
  })
})
