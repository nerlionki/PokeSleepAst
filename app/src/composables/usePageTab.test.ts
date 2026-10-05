import { createSSRApp, h, type WritableComputedRef } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it, vi } from 'vitest'
import { usePageTab } from './usePageTab'

describe('page section history', () => {
  it('restores the previous section and preserves query data when navigating back', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes: [
      { path: '/pokemon', component: { render: () => null } },
      { path: '/team', component: { render: () => null } },
    ] })
    await router.push('/pokemon?uid=keep')
    let tab: WritableComputedRef<'dex' | 'box'> | undefined
    const app = createSSRApp({ setup() {
      tab = usePageTab(['dex', 'box'] as const, 'dex')
      return () => h('div', tab!.value)
    } }).use(router)
    await renderToString(app)
    expect(tab!.value).toBe('dex')
    tab!.value = 'box'
    await vi.waitFor(() => expect(router.currentRoute.value.query.tab).toBe('box'))
    expect(router.currentRoute.value.query.uid).toBe('keep')
    await router.push('/team')
    router.back()
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/pokemon'))
    expect(tab!.value).toBe('box')
    router.back()
    await vi.waitFor(() => expect(tab!.value).toBe('dex'))
    await router.replace('/pokemon?tab=unsupported')
    expect(tab!.value).toBe('dex')
  })
})
