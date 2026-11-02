import { recognize, type OcrModel, type OcrSessions } from '../../../core/src/calc/ocrPipeline'
export { recognize }
export type { PixelImage } from '../../../core/src/calc/ocrVision'
import { loadModelChunk } from '#image-loader'
import dictText from './ocr-dict.json'
import modelInfo from './ocr-models.json'
import { workerErrorMessage } from './workerError'

let loading: Promise<OcrSessions> | null = null
// Both original ONNX inputs contain dynamic axes. WeChat needs a concrete
// conversion shape; run() still supplies each image/crop's actual dimensions.
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
async function openModel(name: string): Promise<OcrModel> {
  if (!wx.createInferenceSession) throw new Error('当前微信或设备不支持本地 OCR，请升级微信或使用手动录入')
  const info = (modelInfo as Record<string, { input: string; output: string }>)[name]!
  const model = await prepareModel(name)
  let session: WechatMiniprogram.InferenceSession
  try {
    session = wx.createInferenceSession({ model, typicalShape: { [info.input]: typicalShapes[name]! }, precisionLevel: 4, allowNPU: false, allowQuantize: false })
  } catch (error) {
    throw modelLoadError(name, error)
  }
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => { session.destroy(); reject(new Error(`OCR ${modelLabels[name]}模型加载超时，请重试`)) }, 60_000)
    session.onLoad(() => { clearTimeout(timer); resolve() })
    session.onError(error => { clearTimeout(timer); session.destroy(); reject(modelLoadError(name, error)) })
  })
  return { dispose: () => session.destroy(), async run(data, dims) {
    const result = await session.run({ [info.input]: { type: 'float32', data: new Float32Array(data).buffer, shape: dims } })
    const tensor = result[info.output]
    if (!tensor) throw new Error('OCR 模型输出不兼容')
    return { data: new Float32Array(tensor.data), dims: tensor.shape }
  } }
}
export function loadOcr(): Promise<OcrSessions> {
  // Avoid concurrent model conversion and its peak memory use in desktop WeChat.
  // A failed detector also prevents an unnecessary recognizer initialization.
  loading ??= (async () => {
    const det = await openModel('det')
    try {
      const rec = await openModel('rec')
      return { det, rec, dict: dictText }
    } catch (error) {
      det.dispose?.()
      throw error
    }
  })().catch(error => { loading = null; throw error })
  return loading
}
