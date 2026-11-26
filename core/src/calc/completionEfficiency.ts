import { ISLANDS, SLEEP_STYLES } from './data'
import { researchActivity, researchSleepStyles, type ResearchActivitySelection } from './activities'
import { resolvedSleepdex, type SleepdexSelection } from './sleep'
import { raeSleepStyleId } from './sleepStyleIdentity'
import type { BabyEfficiencyOptions } from './babyEfficiency'

export type CompletionSelectionMode = 'sleepdex' | 'free'
export interface CompletionEfficiencyOptions extends BabyEfficiencyOptions { selectionMode: CompletionSelectionMode }

/** 图鉴使用同一个 key；跨岛去重，保留百变怪等同星不同睡姿的身份。 */
export function completionTargets(selection: SleepdexSelection, mode: CompletionSelectionMode = 'sleepdex', activity?: ResearchActivitySelection) {
  const found = new Set(mode === 'free' ? [] : resolvedSleepdex(selection))
  const known = new Set<number>()
  const islands = new Set(ISLANDS.map(island => island.id))
  return researchSleepStyles(SLEEP_STYLES, researchActivity(activity)).filter(style => {
    const id = raeSleepStyleId(style)
    if (id == null || style.limited || !islands.has(style.island) || found.has(id) || known.has(id)) return false
    known.add(id)
    return true
  })
}

export function missingCompletionStyles(selection: SleepdexSelection, activity?: ResearchActivitySelection) {
  return completionTargets(selection, 'sleepdex', activity)
}
