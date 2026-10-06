import { recognize, type OcrModel, type OcrSessions } from '../../../core/src/calc/ocrPipeline'
export { recognize }
export type { PixelImage } from '../../../core/src/calc/ocrVision'
import { loadModelChunk } from '#image-loader'
import dictText from './ocr-dict.json'
import modelInfo from './ocr-models.json'

let loading: Promise<OcrSessions> | null = null
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
  const session = wx.createInferenceSession({ model: await prepareModel(name), precisionLevel: 4, allowNPU: false, allowQuantize: false })
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => { session.destroy(); reject(new Error('OCR 模型加载超时，请重试')) }, 60_000)
    session.onLoad(() => { clearTimeout(timer); resolve() })
    session.onError(error => { clearTimeout(timer); session.destroy(); reject(new Error(`OCR 模型无法加载：${error.errMsg ?? String(error)}`)) })
  })
  return { dispose: () => session.destroy(), async run(data, dims) {
    const result = await session.run({ [info.input]: { type: 'float32', data: new Float32Array(data).buffer, shape: dims } })
    const tensor = result[info.output]
    if (!tensor) throw new Error('OCR 模型输出不兼容')
    return { data: new Float32Array(tensor.data), dims: tensor.shape }
  } }
}
export function loadOcr(): Promise<OcrSessions> {
  loading ??= Promise.allSettled([openModel('det'), openModel('rec')]).then(results => {
    const failed = results.find(result => result.status === 'rejected')
    if (failed?.status === 'rejected') {
      for (const result of results) if (result.status === 'fulfilled') result.value.dispose?.()
      throw failed.reason
    }
    return { det: (results[0] as PromiseFulfilledResult<OcrModel>).value, rec: (results[1] as PromiseFulfilledResult<OcrModel>).value, dict: dictText }
  }).catch(error => { loading = null; throw error })
  return loading
}
