import * as ort from 'onnxruntime-web/wasm'
import { recognize, type OcrSessions, type OcrModel, type PixelImage } from '../../../core/src/calc/ocrPipeline'
export { recognize }
export type { PixelImage }

let loading: Promise<OcrSessions> | null = null

function asset(path: string): string {
  const base = import.meta.env.BASE_URL || '/'
  return new URL(path, new URL(base, window.location.href)).toString()
}

export function loadOcr(): Promise<OcrSessions> {
  if (!loading) {
    loading = openOcr().catch((error) => {
      loading = null
      throw error
    })
  }
  return loading
}

export async function createOcrFromBuffers(detBuf: ArrayBuffer, recBuf: ArrayBuffer, dictText: string): Promise<OcrSessions> {
  ort.env.wasm.numThreads = 1
  const options: ort.InferenceSession.SessionOptions = { executionProviders: ['wasm'] }
  const [det, rec] = await Promise.all([
    ort.InferenceSession.create(detBuf, options),
    ort.InferenceSession.create(recBuf, options),
  ])
  const dict = dictText.replace(/^\uFEFF/, '').split(/\r?\n/)
  if (dict.at(-1) === '') dict.pop()
  const wrap = (session: ort.InferenceSession): OcrModel => ({ async run(data, dims) {
    const outputs = await session.run({ [session.inputNames[0]!]: new ort.Tensor('float32', data, dims) })
    const output = outputs[session.outputNames[0]!]!
    return { data: output.data as Float32Array, dims: output.dims }
  } })
  return { det: wrap(det), rec: wrap(rec), dict }
}

async function openOcr(): Promise<OcrSessions> {
  const [detBuf, recBuf, dictText] = await Promise.all([
    fetch(asset('ocr/det.onnx')).then((res) => {
      if (!res.ok) throw new Error('det')
      return res.arrayBuffer()
    }),
    fetch(asset('ocr/rec.onnx')).then((res) => {
      if (!res.ok) throw new Error('rec')
      return res.arrayBuffer()
    }),
    fetch(asset('ocr/keys.txt')).then((res) => {
      if (!res.ok) throw new Error('dict')
      return res.text()
    }),
  ])
  return createOcrFromBuffers(detBuf, recBuf, dictText)
}
