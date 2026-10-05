import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import { readFileSync } from 'node:fs'
import { versionCode } from './src/update/version.ts'

const appVersion = process.env.APP_VERSION ?? JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version
versionCode(appVersion)

export default defineConfig({
  plugins: [vue()],
  define: { __APP_VERSION__: JSON.stringify(appVersion) },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
