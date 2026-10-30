import { DEFAULT_BABY_EFFICIENCY, DEFAULT_COMPLETION_EFFICIENCY, BABY_POKEMON_IDS, validateBabyEfficiency, type BabyEfficiencyOptions } from './babyEfficiency'
import type { CatchPurpose } from './catch'
import type { CompletionSelectionMode } from './completionEfficiency'
import { newUid } from './uid'

export interface EncounterGoal {
  id: string
  purpose: CatchPurpose
  selectionMode: CompletionSelectionMode
  options: BabyEfficiencyOptions
}

export function newEncounterGoal(purpose: CatchPurpose): EncounterGoal {
  return { id: newUid(), purpose, selectionMode: 'sleepdex', options: { ...(purpose === 'sleep' ? DEFAULT_COMPLETION_EFFICIENCY : DEFAULT_BABY_EFFICIENCY) } }
}

/** This preview has its own saved list; the three existing planners stay independent. */
export function normalizeEncounterGoals(saved: unknown): EncounterGoal[] {
  if (!Array.isArray(saved)) return []
  const ids = new Set<string>()
  return saved.flatMap((row): EncounterGoal[] => {
    if (!row || !['catch', 'candy', 'sleep'].includes(row.purpose) || !row.options) return []
    const defaults = row.purpose === 'sleep' ? DEFAULT_COMPLETION_EFFICIENCY : DEFAULT_BABY_EFFICIENCY
    const options = { ...defaults, ...row.options } as BabyEfficiencyOptions
    if (row.purpose !== 'sleep') {
      delete options.completionTarget
      if (!BABY_POKEMON_IDS.includes(options.pokeId)) options.pokeId = DEFAULT_BABY_EFFICIENCY.pokeId
    }
    // Empty/unavailable style selections must remain editable rather than dropping the goal.
    const probe = { ...options, pokeId: DEFAULT_BABY_EFFICIENCY.pokeId }
    delete probe.completionTarget
    const safeOptions = validateBabyEfficiency(probe) ? { ...defaults, pokeId: options.pokeId, completionTarget: options.completionTarget } : options
    const id = typeof row.id === 'string' && row.id && !ids.has(row.id) ? row.id : newUid()
    ids.add(id)
    return [{ id, purpose: row.purpose, selectionMode: row.selectionMode === 'free' ? 'free' : 'sleepdex', options: safeOptions }]
  })
}
