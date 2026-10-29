import { createApp } from 'vue'
import ResourceLoading from '../../core/src/components/shared/ResourceLoading.vue'
import { updateLoadingProgress } from '../../core/src/resources/loadingProgress'
import { resourcesReady } from './platform/resources'
const loading = createApp(ResourceLoading)
loading.mount('#app')
void resourcesReady.then(async () => {
  const { mountApp } = await import('./bootstrap')
  loading.unmount()
  mountApp()
}).catch(() => { updateLoadingProgress({ percent: 100, label: '应用加载失败，请重新打开' }) })
