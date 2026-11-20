export const LITERATURE_UP_WEIGHTS = { normal: 1, small: 3.13, mid: 5.87, large: 10.76 } as const
export type LiteratureUpTier = keyof typeof LITERATURE_UP_WEIGHTS

export interface SleepDrawState {
  slot: number
  remaining: number
  noGauge: boolean
  special: boolean
  belly: boolean
}

export interface LiteratureStyle {
  rowId: number
  internalId: number
  rank: number
  dpr: number
  weight: number
  special: boolean
  belly: boolean
}

/** Scoped observations. An absent entry means the permissions are unknown. */
export interface LiteraturePermissions {
  filler?: boolean
  entire?: boolean
  smaller?: boolean
}

export interface LiteraturePolicy {
  exhaustionOrder: 'budget-first' | 'terminal-first'
  fillerWeight: 'uniform' | 'ordinary'
  fillerLimits: 'source-natural'
  latch: boolean
  permissions: Readonly<Partial<Record<number, LiteraturePermissions>>>
}

export interface SleepDrawUnresolved {
  kind: 'unresolved'
  code: 'missing-evidence' | 'empty-pool' | 'invalid-weight'
  stage: 'setup' | 'ordinary' | 'no-gauge' | 'terminal' | 'camp'
  missing: string[]
  context: string
  state: SleepDrawState
}

export class SleepDrawUnresolvedError extends Error {
  constructor(readonly detail: SleepDrawUnresolved) {
    super('模拟失败，请重试')
    this.name = 'SleepDrawUnresolvedError'
  }
}

export interface SleepDrawBranch<T> {
  style: T
  probability: number
  next: SleepDrawState
}

export type SleepDrawStep<T> = { kind: 'resolved', branches: SleepDrawBranch<T>[] } | SleepDrawUnresolved
export type SleepTransition<T> = (state: SleepDrawState) => SleepDrawStep<T>

export function initialSleepDrawState(remaining: number): SleepDrawState {
  return { slot: 0, remaining, noGauge: false, special: false, belly: false }
}

export function unresolvedSleepDraw(
  context: string, state: SleepDrawState, stage: SleepDrawUnresolved['stage'],
  missing: string[], code: SleepDrawUnresolved['code'] = 'missing-evidence',
): SleepDrawUnresolved {
  return { kind: 'unresolved', code, stage, missing, context, state }
}

export function sleepStateAfter<T extends Pick<LiteratureStyle, 'dpr' | 'special' | 'belly'>>(
  state: SleepDrawState, style: T | undefined, debit: boolean, noGauge = state.noGauge,
): SleepDrawState {
  return {
    slot: state.slot + 1,
    remaining: debit && style ? Math.max(0, state.remaining - style.dpr) : state.remaining,
    special: state.special || Boolean(style?.special),
    belly: state.belly || Boolean(style?.belly),
    noGauge,
  }
}

export function createLiteratureSleepTransition<T extends LiteratureStyle>(
  context: string, slots: number, openSlots: number, typed: readonly T[], open: readonly T[], policy: LiteraturePolicy,
): SleepTransition<T> {
  const compareTie = (a: T, b: T) => a.rank - b.rank || a.internalId - b.internalId
  const sort = (pool: readonly T[]) => [...pool].sort((a, b) => a.dpr - b.dpr || compareTie(a, b))
  const typedSorted = sort(typed)
  const openSorted = open === typed ? typedSorted : sort(open)

  return state => {
    if (state.slot >= slots) return { kind: 'resolved', branches: [] }
    const pool = (state.slot < openSlots ? openSorted : typedSorted).filter(
      style => !(state.special && style.special) && !(state.belly && style.belly),
    )
    const affordable = pool.filter(style => style.dpr <= state.remaining)
    const fail = (stage: SleepDrawUnresolved['stage'], missing: string[], code?: SleepDrawUnresolved['code']) =>
      unresolvedSleepDraw(context, state, stage, missing, code)
    const branch = (style: T, probability: number, debit: boolean, latch = state.noGauge) =>
      ({ style, probability, next: sleepStateAfter(state, style, debit, latch) })
    const weighted = (styles: T[], stage: 'ordinary' | 'no-gauge', uniform: boolean): SleepDrawStep<T> => {
      if (!styles.length) return fail(stage, ['pool'], 'empty-pool')
      const weights = styles.map(style => uniform ? 1 : style.weight)
      const total = weights.reduce((sum, weight) => sum + weight, 0)
      if (!Number.isFinite(total) || total <= 0 || weights.some(weight => !Number.isFinite(weight) || weight < 0)) {
        return fail(stage, ['weights'], 'invalid-weight')
      }
      const branches: SleepDrawBranch<T>[] = []
      styles.forEach((style, index) => {
        const probability = weights[index]! / total
        if (probability > 0) branches.push(branch(style, probability, stage === 'ordinary', stage === 'no-gauge' && policy.latch))
      })
      return { kind: 'resolved', branches }
    }
    const filler = () => {
      const selected: T[] = []
      for (const style of pool) {
        const allowed = policy.permissions[style.rowId]?.filler
        if (typeof allowed !== 'boolean') return fail('no-gauge', [`${style.rowId}:filler`])
        if (allowed) selected.push(style)
        if (selected.length === 10) break
      }
      return weighted(selected, 'no-gauge', policy.fillerWeight === 'uniform')
    }
    const terminal = (): SleepDrawStep<T> => {
      let entire: T | undefined
      let smaller: T | undefined
      for (const style of affordable) {
        const permissions = policy.permissions[style.rowId]
        if (typeof permissions?.entire !== 'boolean' || typeof permissions.smaller !== 'boolean') {
          return fail('terminal', [`${style.rowId}:terminal-permissions`])
        }
        if (permissions.entire && (!entire || style.dpr > entire.dpr)) entire = style
        if (permissions.smaller && (!smaller || style.dpr > smaller.dpr)) smaller = style
      }
      if (!entire || !smaller) {
        return fail('terminal', [...(!entire ? ['entire'] : []), ...(!smaller ? ['smaller'] : [])], 'empty-pool')
      }
      return { kind: 'resolved', branches: entire.rowId === smaller.rowId
        ? [branch(entire, 1, true)]
        : [branch(entire, 0.2, true), branch(smaller, 0.8, true)] }
    }

    if (state.noGauge) return filler()
    if (state.slot === slots - 1 && (affordable.length || policy.exhaustionOrder === 'terminal-first')) return terminal()
    return affordable.length ? weighted(affordable, 'ordinary', false) : filler()
  }
}

export function sampleSleepBranch<T>(branches: readonly SleepDrawBranch<T>[], rng: () => number) {
  if (branches.length < 2) return branches[0]
  let roll = rng()
  for (const branch of branches) {
    roll -= branch.probability
    if (roll < 0) return branch
  }
  return branches.at(-1)
}

/** Mulberry32, with an explicit state for exact checkpoint resumption. */
export function createSleepRandom(seed: number, xorConstant = 61) {
  let state = seed >>> 0
  return {
    get state() { return state },
    next() {
      state = (state + 0x6D2B79F5) >>> 0
      let x = state
      x = Math.imul(x ^ (x >>> 15), x | 1)
      x ^= x + Math.imul(x ^ (x >>> 7), x | xorConstant)
      return ((x ^ (x >>> 14)) >>> 0) / 0x100000000
    },
  }
}
