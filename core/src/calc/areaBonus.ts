import parameters from '../data/rule-parameters.resource'

/** Maintained in SleepAstCore rule-parameters.json, modules.defaults.mergeSettings. */
export const AREA_BONUS_MAX = parameters.modules.defaults.mergeSettings.areaBonusCap
export const AREA_BONUS_MAX_PERCENT = Math.round(AREA_BONUS_MAX * 100)

export function clampAreaBonus(value: unknown): number {
  return Math.min(AREA_BONUS_MAX, Math.max(0, Number(value) || 0))
}
