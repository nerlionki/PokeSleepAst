import { defineAsyncComponent, onScopeDispose, shallowRef, type Component } from 'vue'
import { useReady } from '@tarojs/taro'
import ResourceLoading from '../generated/components/shared/ResourceLoading.vue'
import { resourcesReady, startResources } from './resources'

/** Keep the first render synchronous; download only after that view is ready. */
export function useResourcePage(loader: () => Promise<{ default: Component }>) {
  const ready = shallowRef(false)
  let active = true
  onScopeDispose(() => { active = false })
  void resourcesReady.then(() => { if (active) ready.value = true })
  useReady(() => {
    wx.nextTick(() => { void startResources() })
  })
  const Content = defineAsyncComponent({ loader: async () => (await loader()).default, loadingComponent: ResourceLoading, delay: 0 })
  return { ready, Content }
}
