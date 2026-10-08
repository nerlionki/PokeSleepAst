import { createSleepSelector } from './sleepSelection'
export interface EfficiencyReward { catch: number, candy: number }
export interface EfficiencyBucket extends EfficiencyReward {
  count: number
  typed: boolean
  special: boolean
  dpr: number
  belly?: boolean
  order?: number
}
export interface EfficiencyDrawState {
  buckets: EfficiencyBucket[]
  power: number
  encounters: number
  otherSlots: number
  typedFallback: EfficiencyReward
  openFallback: EfficiencyReward
}
export function drawStateKey(state: EfficiencyDrawState): string { return JSON.stringify(state) }
export function efficiencyRandom(seed: number): () => number {
  let value = seed >>> 0
  return () => {
    value = (value + 0x6D2B79F5) >>> 0
    let x = value
    x = Math.imul(x ^ (x >>> 15), x | 1)
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61)
    return ((x ^ (x >>> 14)) >>> 0) / 0x100000000
  }
}
/** Same DPR selection as sleepDraw, grouping only equivalent rewards and costs. */
export function simulateEfficiencyState(state: EfficiencyDrawState, iterations: number, rng = efficiencyRandom(1)): EfficiencyReward {
  const result = { catch: 0, candy: 0 }
  if (state.buckets.every((bucket) => !bucket.catch && !bucket.candy)
    && !state.typedFallback.catch && !state.typedFallback.candy
    && !state.openFallback.catch && !state.openFallback.candy) return result
  // Precompute type, special and belly restriction combinations, outside the Monte Carlo loop.
  const pools = Array.from({ length: 8 }, (_, mask) => state.buckets.filter((bucket) =>
    (mask & 1 || bucket.typed) && (!(mask & 2) || !bucket.special) && (!(mask & 4) || !bucket.belly)))
  const selectors = pools.map((pool) => createSleepSelector(pool, (bucket) => bucket.count))
  for (let run = 0; run < iterations; run++) {
    let remaining = state.power
    let special = false, belly = false
    for (let slot = 0; slot < state.encounters; slot++) {
      const anyType = slot < state.otherSlots
      const select: ReturnType<typeof createSleepSelector<EfficiencyBucket>> = selectors[Number(anyType) + Number(special) * 2 + Number(belly) * 4]!
      const item: EfficiencyBucket | undefined = select(remaining, slot === state.encounters - 1, rng, state.power < 90_000)
      const reward = item ?? (anyType ? state.openFallback : state.typedFallback)
      result.catch += reward.catch
      result.candy += reward.candy
      if (item) {
        remaining = Math.max(0, remaining - item.dpr)
        special ||= item.special
        belly ||= !!item.belly
      }
    }
  }
  return result
}
