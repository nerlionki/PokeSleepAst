import { searchBabyEfficiency } from './babyEfficiency'
import type { BabyEfficiencyMessage, BabyEfficiencyRequest } from './babyEfficiencyMessages'

const worker = self as unknown as {
  onmessage: ((event: MessageEvent<BabyEfficiencyRequest>) => void) | null
  postMessage: (message: BabyEfficiencyMessage) => void
}
worker.onmessage = (event) => {
  try {
    const result = searchBabyEfficiency(event.data.options, (progress) => worker.postMessage({ type: 'progress', progress }))
    worker.postMessage({ type: 'result', result })
  } catch (error) {
    worker.postMessage({ type: 'error', message: error instanceof Error ? error.message : '计算失败，请重新尝试' })
  }
}
