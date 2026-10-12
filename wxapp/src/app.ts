import { requireWorkerSupport } from './platform/compatibility'
import { createApp, watch } from 'vue'
import { taskNavigationLocked } from '../../core/src/composables/taskNavigationLock'
import { createPinia } from 'pinia'
import Taro from '@tarojs/taro'
import './tailwind.css'
import './app.css'
let tabUpdate = Promise.resolve()
function syncTaskTabBar() {
  // Serialize native calls so a fast finish cannot leave the tab bar hidden.
  tabUpdate = tabUpdate.then(async () => {
    if (taskNavigationLocked.value) await Taro.hideTabBar({ animation: false })
    else await Taro.showTabBar({ animation: false })
  }).catch(() => {})
}
watch(taskNavigationLocked, syncTaskTabBar, { flush: 'sync' })
const app = createApp({
  onShow() { syncTaskTabBar() },
  onLaunch() {
    try { requireWorkerSupport() }
    catch (cause) { void Taro.showModal({ title: '运行版本不符合要求', content: cause instanceof Error ? cause.message : '请更新微信和小程序后重试', showCancel: false }) }
  },
  onUnhandledRejection(event: { reason: unknown }) {
    const reason = event.reason
    void Taro.showToast({ title: reason instanceof Error ? reason.message : '操作失败，请检查本机存储空间后重试', icon: 'none', duration: 4000 })
  },
})
app.use(createPinia())
app.directive('back', {})
export default app
