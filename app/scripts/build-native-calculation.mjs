import { build } from 'vite'
import path from 'node:path'
const root = path.resolve(import.meta.dirname, '..')
await build({ configFile: false, publicDir: false, logLevel: 'warn', build: { emptyOutDir: false, outDir: path.join(root, 'android/app/src/main/assets'), target: 'es2020', minify: 'oxc', lib: { entry: path.join(root, 'src/calc/nativeCalculation.ts'), name: 'Calculation', formats: ['iife'], fileName: () => 'calculation.js' } } })
