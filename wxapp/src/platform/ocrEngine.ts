import { recognize, type OcrModel, type OcrSessions } from '../../../core/src/calc/ocrPipeline'
export { recognize }
export type { PixelImage } from '../../../core/src/calc/ocrVision'
import { loadModelChunk } from '#image-loader'
import dictText from './ocr-dict.json'
import modelInfo from './ocr-models.json'
import { workerErrorMessage } from './workerError'

let loading: Promise<OcrSessions> | null = null
let generation = 0
const typicalShapes: Record<string, number[]> = { det: [1, 3, 640, 640], rec: [1, 3, 48, 320] }
const modelLabels: Record<string, string> = { det: '文字检测', rec: '文字识别' }
function modelLoadError(name: string, error: unknown): Error {
  const device = typeof wx.getDeviceInfo === 'function' ? wx.getDeviceInfo() : wx.getSystemInfoSync()
  const app = typeof wx.getAppBaseInfo === 'function' ? wx.getAppBaseInfo() : wx.getSystemInfoSync()
  const detail = workerErrorMessage(error, '推理引擎初始化失败')
  const codes = error && typeof error === 'object' ? error as { errno?: number; errCode?: number } : {}
  const code = codes.errno ?? codes.errCode
  const environment = `${device.platform} · 微信 ${app.version} · 基础库 ${app.SDKVersion}`
  console.error('[ocr-model-load]', name, environment, error)
  const hint = device.platform === 'windows'
    ? '当前 Windows 微信未能加载本地 OCR 模型，请更新微信后重试，或先在手机微信中导入。'
    : ''
  return new Error(`${hint}OCR ${modelLabels[name]}模型无法加载：${detail}${code == null ? '' : `（错误码 ${code}）`}［${environment}］`)
}
const modelPath = (name: string) => `${wx.env.USER_DATA_PATH}/ocr-${name}-${(modelInfo as Record<string, {hash:string}>)[name]!.hash}.onnx`
async function prepareModel(name: string): Promise<string> {
  const fs = wx.getFileSystemManager()
  const info = (modelInfo as Record<string, {size:number; chunks:Array<{pack:string;size:number}>}>)[name]!
  const target = modelPath(name)
  try { if ((fs.statSync(target) as WechatMiniprogram.Stats).size === info.size) return target } catch {}
  const temporary = target + '.new'
  try {
    const restored = new Uint8Array(info.size)
    let offset = 0
    for (const chunk of info.chunks) {
      const payload = await loadModelChunk(chunk.pack)
      const bytes = fs.readFileSync(payload.path) as ArrayBuffer
      if (bytes.byteLength !== chunk.size) throw new Error('OCR 模型分包不完整，请重新编译小程序')
      restored.set(new Uint8Array(bytes), offset)
      offset += bytes.byteLength
    }
    if (offset !== info.size) throw new Error('OCR 模型还原失败，请重试')
    fs.writeFileSync(temporary, restored.buffer)
    if ((fs.statSync(temporary) as WechatMiniprogram.Stats).size !== info.size) throw new Error('OCR 模型保存失败，请重试')
    fs.renameSync(temporary, target)
    return target
  } catch (error) {
    try { fs.unlinkSync(temporary) } catch {}
    const message = error instanceof Error ? error.message : String(error)
    if (/storage limit|quota|空间|存储/.test(message)) throw new Error('OCR 原模型需要约 16 MB 文件空间；当前环境文件额度不足，请使用支持更大文件额度的微信真机验证')
    throw error
  }
}
async function openSession(name: string, model: string, dims: number[], runTimeout: number, invalidate: () => void): Promise<OcrModel> {
  if (!wx.createInferenceSession) throw new Error('当前微信或设备不支持本地 OCR，请升级微信或使用手动录入')
  const info = (modelInfo as Record<string, { input: string; output: string }>)[name]!
  let session: WechatMiniprogram.InferenceSession
  try {
    session = wx.createInferenceSession({ model, typicalShape: { [info.input]: [...dims] }, precisionLevel: 4, allowNPU: false, allowQuantize: false })
  } catch (error) {
    throw modelLoadError(name, error)
  }
  let disposed = false
  let rejectPending: ((error: Error) => void) | null = null
  const dispose = () => {
    if (disposed) return
    disposed = true
    try { session.destroy() } catch { /* Native engines may already have released a failed session. */ }
    rejectPending?.(new Error(`OCR ${modelLabels[name]}会话已关闭，请重试`))
  }
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => fail(new Error(`OCR ${modelLabels[name]}模型加载超时，请重试`)), 60_000)
      const fail = (error: Error) => { clearTimeout(timer); rejectPending = null; dispose(); reject(error) }
      rejectPending = fail
      session.onError(error => {
        if (disposed) return
        const failure = modelLoadError(name, error)
        rejectPending?.(failure)
        dispose()
        invalidate()
      })
      session.onLoad(() => { if (!disposed) { clearTimeout(timer); rejectPending = null; resolve() } })
    })
  } catch (error) { dispose(); throw error }
  return { dispose, run(data, inputDims) {
    if (disposed) return Promise.reject(new Error(`OCR ${modelLabels[name]}会话已关闭，请重试`))
    return new Promise((resolve, reject) => {
      let settled = false
      const timer = setTimeout(() => finish(new Error(`OCR ${modelLabels[name]}推理超时，请重试`)), runTimeout)
      const finish = (error?: Error, value?: Awaited<ReturnType<OcrModel['run']>>) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        rejectPending = null
        if (error) { dispose(); reject(error) } else resolve(value!)
      }
      rejectPending = error => finish(error)
      // 同步异常、Promise 拒绝、仅触发 onError 或完全没有回调均须结束这次推理。
      void Promise.resolve().then(() => session.run({ [info.input]: {
        type: 'float32', data: new Float32Array(data).buffer, shape: inputDims,
      } })).then(result => {
        const tensor = result[info.output]
        if (!tensor || !tensor.shape?.length || tensor.shape.some(n => !Number.isInteger(n) || n <= 0)) throw new Error('OCR 模型输出不兼容')
        const values = new Float32Array(tensor.data)
        if (values.length !== tensor.shape.reduce((a, b) => a * b, 1)) throw new Error('OCR 模型输出数据不完整')
        finish(undefined, { data: values, dims: tensor.shape })
      }).catch(error => finish(new Error(`OCR ${modelLabels[name]}推理失败：${workerErrorMessage(error, '请重试')}`)))
    })
  } }
}
export function loadOcr(): Promise<OcrSessions> {
  if (loading) return loading
  const version = ++generation
  loading = (async () => {
    const detector = await prepareModel('det')
    const recognizer = await prepareModel('rec')
    const device = typeof wx.getDeviceInfo === 'function' ? wx.getDeviceInfo() : wx.getSystemInfoSync()
    let det: OcrModel, rec: OcrModel
    const reset = () => { if (version === generation) loading = null; det.dispose?.(); rec.dispose?.() }
    const runner = (name: string, model: string) => {
      let bound: OcrModel | null = null, shape = '', disposed = false, running = false
      const initialize = async (dims: number[]) => {
        const key = device.platform === 'ios' ? dims.join(',') : 'dynamic'
        // 仅 iOS 按实际尺寸建会话；其它平台保留原来的典型尺寸和动态输入路径。
        if (!bound || shape !== key) {
          bound?.dispose?.(); bound = null
          const opened = await openSession(name, model, device.platform === 'ios' ? dims : typicalShapes[name]!,
            device.platform === 'ios' ? 30_000 : 120_000, reset)
          if (disposed) { opened.dispose?.(); throw new Error('OCR 会话已失效，请重新导入') }
          bound = opened
          shape = key
        }
      }
      return { initialize, dispose() { disposed = true; bound?.dispose?.(); bound = null }, async run(data: Float32Array, dims: number[]) {
        if (disposed) throw new Error('OCR 会话已失效，请重新导入')
        if (running) throw new Error('OCR 推理尚未完成')
        running = true
        try {
          if (dims.length !== 4 || dims.some(n => !Number.isInteger(n) || n <= 0)
            || data.length !== dims.reduce((a, b) => a * b, 1)) throw new Error('OCR 推理输入尺寸不兼容')
          const input = { data, dims }
          await initialize(input.dims)
          const result = await bound!.run(input.data, input.dims)
          return result
        } catch (error) { reset(); throw error }
        finally { running = false }
      } }
    }
    const detectorRunner = runner('det', detector)
    const recognizerRunner = runner('rec', recognizer)
    det = detectorRunner
    rec = recognizerRunner
    if (device.platform !== 'ios') {
      try {
        await detectorRunner.initialize(typicalShapes.det!)
        await recognizerRunner.initialize(typicalShapes.rec!)
      } catch (error) { reset(); throw error }
    }
    return { det, rec, dict: dictText }
  })().catch(error => { if (version === generation) loading = null; throw error })
  return loading
}
