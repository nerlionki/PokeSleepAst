import { build } from 'vite'
import path from 'node:path'
const root = path.resolve(import.meta.dirname, '..')
// 纯计算包不加载图片目录；部分计算模块兼容导出了图标函数。
await build({ configFile: false, publicDir: false, logLevel: 'warn', plugins: [{ name: 'calculation-images', resolveId(id) { if (id === '#platform/images') return '\0calculation-images' }, load(id) { if (id === '\0calculation-images') return 'export const localImage = () => ""' } }], build: { emptyOutDir: false, outDir: path.join(root, 'android/app/src/main/assets'), target: 'es2020', minify: 'oxc', lib: { entry: path.join(root, 'src/calc/nativeCalculation.ts'), name: 'Calculation', formats: ['iife'], fileName: () => 'calculation.js' } } })
