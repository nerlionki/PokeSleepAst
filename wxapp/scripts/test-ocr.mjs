import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { build } from 'esbuild'

const models = JSON.parse(fs.readFileSync(new URL('../src/platform/ocr-models.json', import.meta.url)))
const { outputFiles } = await build({
  entryPoints: [fileURLToPath(new URL('../src/platform/ocrEngine.ts', import.meta.url))],
  bundle: true, write: false, format: 'iife', globalName: 'ocr', platform: 'neutral',
  plugins: [{ name: 'mock-model-chunks', setup(build) {
    build.onResolve({ filter: /^#image-loader$/ }, () => ({ path: 'chunks', namespace: 'test' }))
    build.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: 'export function loadModelChunk() { throw new Error("Unexpected cache miss") }' }))
  } }],
})

function environment(failures = {}) {
  const calls = []
  const context = vm.createContext({ Float32Array, Uint8Array, setTimeout, clearTimeout, wx: {
    env: { USER_DATA_PATH: '/cache' },
    getFileSystemManager: () => ({ statSync: path => ({ size: models[path.includes('ocr-det-') ? 'det' : 'rec'].size }) }),
    createInferenceSession(options) {
      const name = options.model.includes('ocr-det-') ? 'det' : 'rec'
      const call = { name, options, destroyed: 0, inputs: [] }
      calls.push(call)
      if (failures[name] === 'throw') throw new Error('create session fail')
      return {
        onLoad(callback) { if (!failures[name]) queueMicrotask(callback) },
        onError(callback) { if (failures[name]) queueMicrotask(() => callback({ errMsg: 'Failed to convert onnx model' })) },
        destroy() { call.destroyed++ },
        async run(inputs) {
          call.inputs.push(inputs)
          return { [models[name].output]: { data: new Float32Array([1]).buffer, shape: [1, 1, 1] } }
        },
      }
    },
  } })
  vm.runInContext(outputFiles[0].text, context)
  return { engine: context.ocr, calls }
}

test('dynamic ONNX conversion receives named typical shapes; inference keeps actual shapes', async () => {
  const { engine, calls } = environment()
  const [sessions, same] = await Promise.all([engine.loadOcr(), engine.loadOcr()])
  assert.equal(sessions, same)
  assert.equal(calls.length, 2)
  for (const call of calls) {
    assert.deepEqual(JSON.parse(JSON.stringify(call.options.typicalShape)), { [models[call.name].input]: call.name === 'det' ? [1, 3, 640, 640] : [1, 3, 48, 320] })
    assert.equal(call.options.allowQuantize, false)
  }
  for (const [name, dims] of [['det', [1, 3, 960, 448]], ['rec', [1, 3, 48, 80]]]) {
    await sessions[name].run(new Float32Array(dims.reduce((a, b) => a * b, 1)), dims)
    assert.deepEqual(calls.find(call => call.name === name).inputs[0][models[name].input].shape, dims)
    sessions[name].dispose()
  }
  assert.ok(calls.every(call => call.destroyed === 1))
})

test('conversion failure identifies both models and releases sessions', async () => {
  const { engine, calls } = environment({ det: 'error', rec: 'error' })
  await assert.rejects(engine.loadOcr(), error => /文字检测.*Failed to convert/.test(error.message) && /文字识别.*Failed to convert/.test(error.message))
  assert.ok(calls.every(call => call.destroyed === 1))
})

test('partial failure releases the successful session and permits retry', async () => {
  const failures = { rec: 'error' }
  const { engine, calls } = environment(failures)
  await assert.rejects(engine.loadOcr(), /文字识别/)
  assert.ok(calls.every(call => call.destroyed === 1))
  delete failures.rec
  const sessions = await engine.loadOcr()
  assert.equal(calls.length, 4)
  sessions.det.dispose()
  sessions.rec.dispose()
})

test('synchronous native conversion errors retain model context', async () => {
  const { engine, calls } = environment({ det: 'throw' })
  await assert.rejects(engine.loadOcr(), /文字检测.*create session fail/)
  assert.equal(calls.find(call => call.name === 'rec').destroyed, 1)
})
