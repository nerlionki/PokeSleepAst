import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { versionCode } from './src/update/version.ts'

const appVersion = process.env.APP_VERSION ?? JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version
versionCode(appVersion)

export default defineConfig({
  publicDir: false,
  plugins: [vue(), {
    name: 'public-runtime-assets',
    generateBundle() {
      const root = fileURLToPath(new URL('../core/public', import.meta.url))
      const walk = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(join(directory, entry.name)) : [join(directory, entry.name)])
      // OCR runtime assets are not UI images and remain available offline.
      for (const file of walk(root)) {
        const name = relative(root, file).replaceAll('\\', '/')
        if (name === 'favicon.svg' || name === 'icons.svg' || name.startsWith('ocr/')) this.emitFile({ type: 'asset', fileName: name, source: readFileSync(file) })
      }
    },
  }],
  worker: { format: 'es' },
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
