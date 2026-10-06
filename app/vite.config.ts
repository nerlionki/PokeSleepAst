import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import { readFileSync } from 'node:fs'
import { versionCode } from './src/update/version.ts'

const appVersion = process.env.APP_VERSION ?? JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version
versionCode(appVersion)

export default defineConfig({
  publicDir: '../core/public',
  plugins: [vue()],
  define: { __APP_VERSION__: JSON.stringify(appVersion) },
  resolve: {
    dedupe: ['vue', 'pinia'],
    alias: {
      '#platform': fileURLToPath(new URL('./src/platform', import.meta.url)),
      vue: fileURLToPath(new URL('./node_modules/vue/dist/vue.runtime.esm-bundler.js', import.meta.url)),
      pinia: fileURLToPath(new URL('./node_modules/pinia/dist/pinia.js', import.meta.url)),
      'vue-router': fileURLToPath(new URL('./node_modules/vue-router/dist/vue-router.js', import.meta.url)),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
