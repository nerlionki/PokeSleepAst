import type { BabyEfficiencyOptions, BabyEfficiencyResult, EfficiencyProgress } from './babyEfficiency'

export type BabyEfficiencyMessage =
  | { type: 'progress', progress: EfficiencyProgress }
  | { type: 'result', result: BabyEfficiencyResult }
  | { type: 'error', message: string }
export interface BabyEfficiencyRequest { options: BabyEfficiencyOptions }
