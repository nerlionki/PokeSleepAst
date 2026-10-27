import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'
import { recordAppLog } from './appLogs'
export interface CalculationWorker<Request, Message> {
  onmessage: ((event: { data: Message }) => void) | null
  onerror: ((error?: unknown) => void) | null
  postMessage(request: Request): void
  terminate(): void
}
interface NativeMessage { id: string, sequence: number, message: unknown }
// CalculationService adds this prefix only for native execution failures.
// Errors returned by the calculation itself must remain visible to the caller.
function nativeExecutionFailed(message: unknown): boolean {
  if (!message || typeof message !== 'object') return false
  const error = message as { type?: unknown, message?: unknown }
  return error.type === 'error' && typeof error.message === 'string' && error.message.startsWith('后台计算失败：')
}
interface BackgroundCalculationPlugin {
  start(options: { id: string, kind: 'baby' | 'sleep' | 'score', request: unknown }): Promise<void>
  cancel(options: { id: string }): Promise<void>
  status(options: { id: string }): Promise<NativeMessage | { id: string }>
  addListener(event: 'calculationMessage', listener: (event: NativeMessage) => void): Promise<PluginListenerHandle>
}
const native = registerPlugin<BackgroundCalculationPlugin>('BackgroundCalculation')
export function createCalculationWorker<Request, Message>(kind: 'baby' | 'sleep' | 'score', browserWorker: () => Worker, onFallback: (notice: string) => void = () => {}): CalculationWorker<Request, Message> {
  const logMessage = (message: unknown, backend: string) => {
    if (message && typeof message === 'object' && 'type' in message && message.type === 'error') recordAppLog('calculation.result', message, { kind, backend })
  }
  if (Capacitor.getPlatform() !== 'android') {
    const worker = browserWorker()
    const adapter: CalculationWorker<Request, Message> = { onmessage: null, onerror: null,
      postMessage: (request) => worker.postMessage(request), terminate: () => worker.terminate() }
    worker.onmessage = (event) => { logMessage(event.data, 'worker'); adapter.onmessage?.({ data: event.data as Message }) }
    worker.onerror = (event) => { recordAppLog('calculation.worker', event.error ?? event.message, { kind }); adapter.onerror?.(event) }
    return adapter
  }
  const id = `calc-${Date.now()}-${Math.random().toString(36).slice(2)}`
  let fallback: Worker | null = null
  let usingFallback = false
  let startFallback: ((cause: unknown) => void) | null = null
  let disposed = false, listener: PluginListenerHandle | null = null, sequence = 0
  const receive = (event: NativeMessage) => {
    if (disposed || usingFallback || event.id !== id || event.sequence <= sequence) return
    sequence = event.sequence
    if (nativeExecutionFailed(event.message)) { startFallback?.(event.message); return }
    logMessage(event.message, 'native')
    adapter.onmessage?.({ data: event.message as Message })
  }
  const resume = () => { if (!disposed && !usingFallback) void native.status({ id }).then((event) => { if ('message' in event) receive(event) }).catch((error) => startFallback?.(error)) }
  function stopNative() {
    window.removeEventListener('appCalculationResume', resume)
    const current = listener; listener = null
    void Promise.resolve(current?.remove()).catch(() => {})
    void native.cancel({ id }).catch(() => {})
  }
  const adapter: CalculationWorker<Request, Message> = {
    onmessage: null, onerror: null,
    postMessage(request) {
      if (disposed) return
      startFallback = (cause) => {
        if (disposed || usingFallback) return
        usingFallback = true
        recordAppLog('calculation.native', cause, { kind, request })
        stopNative()
        try {
          fallback = browserWorker()
          fallback.onmessage = (event) => { if (!disposed) { logMessage(event.data, 'foreground'); adapter.onmessage?.({ data: event.data as Message }) } }
          fallback.onerror = (error) => { if (!disposed) { recordAppLog('calculation.foreground', error.error ?? error.message, { kind }); adapter.onerror?.(error) } }
          onFallback('原生后台计算暂不可用，已改用前台计算并重新开始；请保持应用在前台，息屏或切换应用可能暂停。')
          fallback.postMessage(request)
          recordAppLog('calculation.fallback', '已使用原参数重新启动前台计算', { kind }, 'warn')
        } catch (error) {
          fallback?.terminate(); fallback = null
          recordAppLog('calculation.foreground.start', error, { kind })
          adapter.onerror?.(error)
        }
      }
      void (async () => {
        try {
          listener = await native.addListener('calculationMessage', receive)
          if (disposed || usingFallback) { await listener.remove(); listener = null; return }
          window.addEventListener('appCalculationResume', resume)
          await native.start({ id, kind, request })
          // Cancellation can happen while the native service is being created.
          if (disposed || usingFallback) await native.cancel({ id })
          else resume()
        } catch (error) {
          startFallback?.(error)
        }
      })()
    },
    terminate() {
      if (disposed) return
      disposed = true; fallback?.terminate(); stopNative()
    },
  }
  return adapter
}
