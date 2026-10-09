import { requireWorkerSupport } from './platform/compatibility'
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Taro from '@tarojs/taro'
import './tailwind.css'
import './app.css'
const app = createApp({
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
