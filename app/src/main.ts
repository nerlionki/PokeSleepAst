import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router'
import './style.css'
import { Capacitor } from '@capacitor/core'
import { backDirective, installAndroidBack } from './navigation/back'

const app = createApp(App).use(createPinia()).use(router).directive('back', backDirective)
if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') installAndroidBack(router)
app.mount('#app')
