import { receiveResources, type ResourceSnapshot } from './runtime'
/** Load calculation modules only after receiving the main thread's snapshot. */
export function bootResourceWorker(load: () => Promise<unknown>) {
  type Event = MessageEvent<{ __sleepastResources?: ResourceSnapshot }>
  const scope = globalThis as unknown as { onmessage: ((event: Event) => void) | null; postMessage(message: unknown): void }
  const pending: Event[] = []
  let loading: Promise<void> | undefined
  scope.onmessage = event => {
    pending.push(event)
    loading ??= (async () => {
      try {
        receiveResources(event.data)
        await load()
        const handler = scope.onmessage!
        for (const message of pending.splice(0)) handler(message)
      } catch (cause) { scope.postMessage({ type: 'error', message: cause instanceof Error ? cause.message : '计算资源加载失败' }) }
    })()
  }
}
