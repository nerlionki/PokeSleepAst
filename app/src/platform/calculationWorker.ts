import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'
export interface CalculationWorker<Request, Message> {
  onmessage: ((event: { data: Message }) => void) | null
  onerror: ((error?: unknown) => void) | null
  postMessage(request: Request): void
  terminate(): void
}
interface NativeMessage { id: string, sequence: number, message: unknown }
interface BackgroundCalculationPlugin {
  start(options: { id: string, kind: 'baby' | 'sleep', request: unknown }): Promise<void>
  cancel(options: { id: string }): Promise<void>
  status(options: { id: string }): Promise<NativeMessage | { id: string }>
  addListener(event: 'calculationMessage', listener: (event: NativeMessage) => void): Promise<PluginListenerHandle>
}
const native = registerPlugin<BackgroundCalculationPlugin>('BackgroundCalculation')
export function createCalculationWorker<Request, Message>(kind: 'baby' | 'sleep', browserWorker: () => Worker, onFallback: (notice: string) => void = () => {}): CalculationWorker<Request, Message> {
  if (Capacitor.getPlatform() !== 'android') {
    const worker = browserWorker()
    const adapter: CalculationWorker<Request, Message> = { onmessage: null, onerror: null,
      postMessage: (request) => worker.postMessage(request), terminate: () => worker.terminate() }
    worker.onmessage = (event) => adapter.onmessage?.({ data: event.data as Message })
    worker.onerror = (event) => adapter.onerror?.(event)
    return adapter
  }
  const id = `calc-${Date.now()}-${Math.random().toString(36).slice(2)}`
  let fallback: Worker | null = null
  let disposed = false, listener: PluginListenerHandle | null = null, sequence = 0
  const receive = (event: NativeMessage) => {
    if (disposed || event.id !== id || event.sequence <= sequence) return
    sequence = event.sequence; adapter.onmessage?.({ data: event.message as Message })
  }
  const resume = () => { if (!disposed) void native.status({ id }).then((event) => { if ('message' in event) receive(event) }).catch((error) => adapter.onerror?.(error)) }
  const adapter: CalculationWorker<Request, Message> = {
    onmessage: null, onerror: null,
    postMessage(request) {
      void (async () => {
        try {
          listener = await native.addListener('calculationMessage', receive)
          if (disposed) { await listener.remove(); return }
          window.addEventListener('appCalculationResume', resume)
          await native.start({ id, kind, request })
          // Cancellation can happen while the native service is being created.
          if (disposed) await native.cancel({ id })
          else resume()
        } catch (error) {
          if (disposed) return
          // Keep foreground calculation available on Android 7 or an older WebView.
          try {
            fallback = browserWorker()
            fallback.onmessage = (event) => { if (!disposed) adapter.onmessage?.({ data: event.data as Message }) }
            fallback.onerror = (cause) => { if (!disposed) adapter.onerror?.(cause) }
            onFallback('原生后台计算暂不可用，已改用前台计算；息屏或切换应用可能暂停。请更新 Android System WebView。')
            fallback.postMessage(request)
          } catch { adapter.onerror?.(error) }
        }
      })()
    },
    terminate() {
      if (disposed) return
      disposed = true; fallback?.terminate(); window.removeEventListener('appCalculationResume', resume)
      void listener?.remove(); void native.cancel({ id }).catch(() => {})
    },
  }
  return adapter
}
