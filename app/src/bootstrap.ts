import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router'
import './style.css'
import { Capacitor } from '@capacitor/core'
import { backDirective, installAndroidBack } from './navigation/back'
import { confirmAppExit } from './platform/appNavigation'
import { installAppLogging } from './platform/appLogs'
import { installImageFallbacks } from './platform/images'
import { installActivityClock } from './platform/activityClock'

export function mountApp() {
  const app = createApp(App).use(createPinia()).use(router).directive('back', backDirective)
  installAppLogging(app)
  installImageFallbacks()
  installActivityClock()
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') installAndroidBack(router, window, confirmAppExit)
  app.mount('#app')

}
