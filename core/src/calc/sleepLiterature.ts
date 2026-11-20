import { highestSleepUp } from './sleepSelection'
import { sha256, utf8 } from '../resources/sha256'
import {
  createLiteratureSleepTransition, initialSleepDrawState, LITERATURE_UP_WEIGHTS,
  SleepDrawUnresolvedError, unresolvedSleepDraw,
  type LiteraturePolicy, type LiteratureStyle, type LiteratureUpTier,
} from './sleepTransition'

/** Internal research configuration. Permissions and inventories are scoped evidence. */
export interface LiteratureSleepStudy {
  version: 'literature-candidate-v1'
  scope: string
  source: string
  typedRowIds: readonly number[]
  openRowIds?: readonly number[]
  policy: LiteraturePolicy
  activityUps?: Readonly<Partial<Record<number, LiteratureUpTier>>>
  camp?: 'source-compatible'
}

interface StudyStyle<T> extends LiteratureStyle {
  style: T
  priority: number
}

export interface SleepStudyRow<T> {
  style: T
  rowId: number
  internalId?: number
  rank?: number
  dpr: number
  settled: boolean
  special: boolean
  belly: boolean
}

type StudyWeights = { weight: number, priority: number } | undefined

export function prepareSleepStudy<T>(input: {
  study: LiteratureSleepStudy
  scope: string
  slots: number
  openSlots: number
  power: number
  rank: number
  typed: SleepStudyRow<T>[]
  open: SleepStudyRow<T>[]
  weights: (style: T) => StudyWeights
  campTicket?: boolean
}) {
  const { study, scope, slots, openSlots, power, rank, weights } = input
  const initial = initialSleepDrawState(power)
  const context = sha256(utf8(JSON.stringify([scope, study])))
  const fail = (stage: 'setup' | 'camp', missing: string[], code?: 'empty-pool') => {
    throw new SleepDrawUnresolvedError(unresolvedSleepDraw(context, initial, stage, missing, code))
  }
  if (study.version !== 'literature-candidate-v1' || study.scope !== scope || !study.source?.trim()) fail('setup', ['scoped-evidence'])
  if (!Number.isFinite(power) || power < 0 || power > Number.MAX_SAFE_INTEGER) fail('setup', ['power'])
  if (rank < 0 || !Number.isInteger(rank)) fail('setup', ['rank'])
  if (!study.policy?.permissions || !['budget-first', 'terminal-first'].includes(study.policy.exhaustionOrder)
    || !['uniform', 'ordinary'].includes(study.policy.fillerWeight) || study.policy.fillerLimits !== 'source-natural'
    || typeof study.policy.latch !== 'boolean') {
    fail('setup', ['transition-policy'])
  }

  const missing: string[] = []
  const prepare = (rows: SleepStudyRow<T>[], expected: readonly number[] | undefined, label: string) => {
    const result: StudyStyle<T>[] = []
    const internalIds = new Map<number, number>()
    const actual = new Set(rows.map(row => row.rowId))
    if (!expected || actual.size !== rows.length || new Set(expected).size !== expected.length) {
      missing.push(`${label}:row-inventory`)
    } else {
      for (const id of expected) if (!actual.has(id)) missing.push(`${label}:${id}:missing-row`)
      const declared = new Set(expected)
      for (const id of actual) if (!declared.has(id)) missing.push(`${label}:${id}:unexpected-row`)
    }
    for (const row of rows) {
      const knownRank = row.rank !== undefined && Number.isInteger(row.rank) && row.rank >= 0 ? row.rank : undefined
      if (knownRank === undefined) missing.push(`${label}:${row.rowId}:rank`)
      else if (knownRank > rank) continue
      const internalId = row.internalId
      const weighted = weights(row.style)
      if (!row.settled || !Number.isSafeInteger(row.dpr) || row.dpr < 0) missing.push(`${label}:${row.rowId}:dpr`)
      if (internalId === undefined || !Number.isSafeInteger(internalId) || internalId <= 0) {
        missing.push(`${label}:${row.rowId}:internal-id`)
      } else {
        const previous = internalIds.get(internalId)
        if (previous !== undefined) missing.push(`${label}:${previous}:${row.rowId}:duplicate-internal-id`)
        internalIds.set(internalId, row.rowId)
      }
      if (!weighted) missing.push(`${label}:${row.rowId}:activity-up`)
      if (internalId !== undefined && knownRank !== undefined && weighted) result.push({ ...row, internalId, rank: knownRank, ...weighted })
    }
    return result
  }
  const typed = prepare(input.typed, study.typedRowIds, 'typed')
  const open = openSlots ? prepare(input.open, study.openRowIds, 'open') : typed
  if (missing.length) fail('setup', missing)

  if (input.campTicket && study.camp !== 'source-compatible') fail('camp', ['camp-policy'])
  const camp = input.campTicket ? highestSleepUp(typed.filter(style => style.dpr <= power), style => style.priority) : []
  if (input.campTicket && !camp.length) fail('camp', ['camp-pool'], 'empty-pool')
  return { initial, slots, camp, context, transition: createLiteratureSleepTransition(context, slots, openSlots, typed, open, study.policy) }
}

export function studyEncounterWeights(manual: readonly LiteratureUpTier[], activity: LiteratureUpTier, bonus: number) {
  const weights = [...new Set([...manual, activity])].map(tier => LITERATURE_UP_WEIGHTS[tier])
  return { weight: weights.reduce((product, value) => product * value, bonus), priority: Math.max(...weights) }
}
