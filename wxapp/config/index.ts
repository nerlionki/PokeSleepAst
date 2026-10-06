import path from 'node:path'
import fs from 'node:fs'
import { defineConfig } from '@tarojs/cli'

export default defineConfig({
  projectName: 'pokesleep-wxapp',
  date: '2026-10-06',
  designWidth: 750,
  deviceRatio: { 375: 2, 640: 1.17, 750: 1 },
  sourceRoot: 'src',
  outputRoot: 'dist',
  framework: 'vue3',
  compiler: 'webpack5',
  plugins: ['@tarojs/plugin-html'],
  alias: {
    '#platform': path.resolve(__dirname, '../src/platform'),
    'vue-router': path.resolve(__dirname, '../src/platform/router.ts'),
    vue: path.resolve(__dirname, '../node_modules/vue/dist/vue.runtime.esm-bundler.js'),
    pinia: path.resolve(__dirname, '../node_modules/pinia/dist/pinia.js'),
  },
  defineConstants: { __APP_VERSION__: JSON.stringify('1.0.3') },
  copy: { patterns: [
    { from: 'src/workers', to: 'dist/workers' },
    { from: 'src/native/image-loader.js', to: 'dist/image-loader.js' },
    ...fs.readdirSync(path.resolve(__dirname, '../src')).filter(name => /^asset-pack\d+$/.test(name)).map(name => ({ from: `src/${name}`, to: `dist/${name}`, ignore: ['**/*.vue', '**/*.ts'] })),
  ] },
  mini: {
    compile: { include: [path.resolve(__dirname, '../../core')] },
    postcss: { pxtransform: { enable: true }, cssModules: { enable: false } },
    webpackChain(chain) {
      chain.resolve.modules.add(path.resolve(__dirname, '../node_modules'))
      chain.externals({ '#image-loader': 'commonjs ./image-loader.js' })
    },
  },
})
