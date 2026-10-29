import { ISLANDS, SLEEP_STYLES } from './data'
import { activitySleepStyles, createActivityContext, type ActivitySelection } from './activities'
import { resolvedSleepdex, styleKey, type SleepdexSelection } from './sleep'
import type { BabyEfficiencyOptions } from './babyEfficiency'

export type CompletionSelectionMode = 'sleepdex' | 'free'
export interface CompletionEfficiencyOptions extends BabyEfficiencyOptions { selectionMode: CompletionSelectionMode }

/** 图鉴使用同一个 key；跨岛去重，保留百变怪等同星不同睡姿的身份。 */
export function completionTargets(selection: SleepdexSelection, mode: CompletionSelectionMode = 'sleepdex', activity?: ActivitySelection) {
  const found = new Set(mode === 'free' ? [] : resolvedSleepdex(selection))
  const known = new Set<string>()
  const islands = new Set(ISLANDS.map(island => island.id))
  return activitySleepStyles(SLEEP_STYLES, createActivityContext('research', activity)).filter(style => {
    const key = styleKey(style.pokeId, style.stars, style.styleId)
    if (style.limited || !islands.has(style.island) || found.has(key) || known.has(key)) return false
    known.add(key)
    return true
  })
}

export function missingCompletionStyles(selection: SleepdexSelection, activity?: ActivitySelection) {
  return completionTargets(selection, 'sleepdex', activity)
}
