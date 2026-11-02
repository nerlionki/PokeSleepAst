import { build } from 'vite'
import path from 'node:path'
import fs from 'node:fs/promises'
const root = path.resolve(import.meta.dirname, '..')
// 纯计算包不加载图片目录；部分计算模块兼容导出了图标函数。
await build({ configFile: false, publicDir: false, logLevel: 'warn', plugins: [{ name: 'calculation-images', resolveId(id) { if (id === '#platform/images') return '\0calculation-images' }, load(id) { if (id === '\0calculation-images') return 'export const localImage = () => ""; export const publicImage = () => ""; export const bundledImage = value => value' } }], build: { emptyOutDir: false, outDir: path.join(root, 'android/app/src/main/assets'), target: 'es2020', minify: 'oxc', lib: { entry: path.join(root, 'src/calc/nativeCalculation.ts'), name: 'Calculation', formats: ['iife'], fileName: () => 'calculation.js' } } })
// Initialize derived constants inside the factory after installing the task's
// snapshot. Android's service keeps its existing beginTask/nextTask protocol.
const file = path.join(root, 'android/app/src/main/assets/calculation.js')
const source = await fs.readFile(file, 'utf8')
await fs.writeFile(file, `var Calculation = (() => { let engine; return { beginTask(kind, request) { globalThis.__sleepastResources = request.__sleepastResources; engine = (() => { ${source}\nreturn Calculation; })(); engine.beginTask(kind, request); }, nextTask() { return engine.nextTask(); } }; })();\n`)
