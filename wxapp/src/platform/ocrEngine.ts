import { recognize, type OcrModel, type OcrSessions } from '../../../core/src/calc/ocrPipeline'
export { recognize }
export type { PixelImage } from '../../../core/src/calc/ocrVision'
import dictText from './ocr-dict.json'
import modelInfo from './ocr-models.json'

let loading: Promise<OcrSessions> | null = null
const modelPath = (name: string) => `${wx.env.USER_DATA_PATH}/ocr-${name}.onnx`
export function hasOcrModels(): boolean {
  try { for (const name of ['det', 'rec']) wx.getFileSystemManager().accessSync(modelPath(name)); return true } catch { return false }
}
export async function importOcrModels(): Promise<void> {
  const selected = await new Promise<WechatMiniprogram.ChooseMessageFileSuccessCallbackResult>((resolve, reject) => wx.chooseMessageFile({ count: 2, type: 'file', extension: ['onnx'], success: resolve, fail: reject }))
  const fs = wx.getFileSystemManager()
  const files = ['det', 'rec'].map(name => {
    const item = selected.tempFiles.find(f => f.name === `${name}.onnx`)
    if (!item || item.size !== (modelInfo as Record<string, { size: number }>)[name]!.size) throw new Error(`请选择提供的模型包中的 ${name}.onnx，文件名和大小必须匹配`)
    return { name, path: item.path }
  })
  // Validate both files before replacing either cached model.
  for (const item of files) fs.copyFileSync(item.path, modelPath(item.name) + '.new')
  if (loading) {
    const sessions = await loading.catch(() => null)
    sessions?.det.dispose?.(); sessions?.rec.dispose?.()
  }
  loading = null
  for (const item of files) fs.renameSync(modelPath(item.name) + '.new', modelPath(item.name))
}
async function openModel(name: string): Promise<OcrModel> {
  if (!wx.createInferenceSession) throw new Error('当前微信或设备不支持本地 OCR，请升级微信或使用手动录入')
  const info = (modelInfo as Record<string, { input: string; output: string }>)[name]!
  const session = wx.createInferenceSession({ model: modelPath(name), precisionLevel: 4, allowNPU: false, allowQuantize: false })
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
  if (!hasOcrModels()) return Promise.reject(new Error('请先在“我的”页面导入 OCR 模型文件'))
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
