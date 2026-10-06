import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Taro from '@tarojs/taro'
import './app.css'
const app = createApp({
  onUnhandledRejection(event: { reason: unknown }) {
    const reason = event.reason
    void Taro.showToast({ title: reason instanceof Error ? reason.message : '操作失败，请检查本机存储空间后重试', icon: 'none', duration: 4000 })
  },
})
app.use(createPinia())
app.directive('back', {})
export default app
