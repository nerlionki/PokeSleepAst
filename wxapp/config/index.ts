import path from 'node:path'
import fs from 'node:fs'
import { defineConfig } from '@tarojs/cli'
import { WeappTailwindcss } from 'weapp-tailwindcss/webpack'
import { NativeImageLoaderPlugin } from './native-image-loader.cjs'

export default defineConfig({
  projectName: 'pokesleep-wxapp',
  date: '2026-10-06',
  designWidth: 375,
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
  defineConstants: { __APP_VERSION__: JSON.stringify(JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8')).version) },
  copy: { patterns: [
    { from: 'src/workers', to: 'dist/workers' },
    { from: 'src/native/image-loader.js', to: 'dist/image-loader.js' },
    ...fs.readdirSync(path.resolve(__dirname, '../src')).filter(name => /^(asset|ocr)-pack\d+$/.test(name)).map(name => ({ from: `src/${name}`, to: `dist/${name}`, ignore: ['**/*.vue', '**/*.ts'] })),
  ] },
  mini: {
    compile: { include: [path.resolve(__dirname, '../../core')] },
    postcss: {
      pxtransform: { enable: true }, cssModules: { enable: false },
      htmltransform: { enable: true, config: { removeCursorStyle: false } },
    },
    webpackChain(chain) {
      chain.resolve.modules.add(path.resolve(__dirname, '../node_modules'))
      chain.module.rule('compressed-core-data')
        .test(/\.json$/)
        .include.add(path.resolve(__dirname, '../../core/src/data')).end()
        .type('javascript/auto')
        .use('compressed-json').loader(path.resolve(__dirname, 'compressed-json.cjs'))
      chain.externals({ '#image-loader': 'commonjs ./image-loader.js' })
      chain.plugin('native-image-loader-paths').use(NativeImageLoaderPlugin)
      chain.plugin('weapp-tailwindcss').use(WeappTailwindcss, [{
        tailwindcssBasedir: path.resolve(__dirname, '..'),
        cssEntries: [path.resolve(__dirname, '../src/tailwind.css')],
        cssOptions: { rem2rpx: true, injectAdditionalCssVarScope: true, cssPreflight: false, cssSelectorReplacement: { root: 'page' } },
      }])
    },
  },
})
