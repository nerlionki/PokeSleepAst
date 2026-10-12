import { createSleepSelector } from './sleepSelection'
export interface EfficiencyReward { catch: number, candy: number }
export interface EfficiencyBucket extends EfficiencyReward {
  count: number
  typed: boolean
  special: boolean
  dpr: number
  belly?: boolean
  order?: number
  unlockRank?: number
  weight?: number
}
export interface EfficiencyDrawState {
  buckets: EfficiencyBucket[]
  researchedBefore?: number
  power: number
  encounters: number
  otherSlots: number
  typedFallback: EfficiencyReward
  openFallback: EfficiencyReward
}
export function createDrawStateKey() {
  const arrays = new WeakMap<EfficiencyBucket[], number>()
  const signatures = new Map<string, number>()
  return (state: EfficiencyDrawState) => {
    let id = arrays.get(state.buckets)
    if (id == null) { const signature = JSON.stringify(state.buckets); id = signatures.get(signature); if (id == null) { id = signatures.size; signatures.set(signature, id) }; arrays.set(state.buckets, id) }
    return [id, state.power, state.encounters, state.otherSlots, state.researchedBefore ?? 0, state.typedFallback.catch, state.typedFallback.candy, state.openFallback.catch, state.openFallback.candy].join(':')
  }
}
export function drawStateKey(state: EfficiencyDrawState): string { return JSON.stringify(state) }
const selectorCache = new WeakMap<EfficiencyBucket[], ReturnType<typeof createSleepSelector<EfficiencyBucket>>[]>()
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
export interface EfficiencySimulation extends EfficiencyReward { slotCandy: number[], slotFamily: number[] }
export function simulateEfficiencySlots(state: EfficiencyDrawState, iterations: number, rng = efficiencyRandom(1)): EfficiencySimulation {
  const result: EfficiencySimulation = { catch: 0, candy: 0, slotCandy: Array(state.encounters).fill(0), slotFamily: Array(state.encounters).fill(0) }
  if (state.buckets.every((bucket) => !bucket.catch && !bucket.candy)
    && !state.typedFallback.catch && !state.typedFallback.candy
    && !state.openFallback.catch && !state.openFallback.candy) return result
  // Precompute type, special and belly restriction combinations, outside the Monte Carlo loop.
  let selectors = selectorCache.get(state.buckets)
  if (!selectors) {
    const pools = Array.from({ length: 8 }, (_, mask) => state.buckets.filter((bucket) =>
    (mask & 1 || bucket.typed) && (!(mask & 2) || !bucket.special) && (!(mask & 4) || !bucket.belly)))
    selectors = pools.map((pool) => createSleepSelector(pool, (bucket) => bucket.count * (bucket.weight ?? 1)))
    selectorCache.set(state.buckets, selectors)
  }
  for (let run = 0; run < iterations; run++) {
    let remaining = state.power
    let special = false, belly = false
    for (let slot = 0; slot < state.encounters; slot++) {
      const anyType = slot < state.otherSlots
      const select: ReturnType<typeof createSleepSelector<EfficiencyBucket>> = selectors[Number(anyType) + Number(special) * 2 + Number(belly) * 4]!
      const item: EfficiencyBucket | undefined = select(remaining, slot === state.encounters - 1, rng)
      const reward = item ?? (anyType ? state.openFallback : state.typedFallback)
      result.catch += reward.catch
      result.candy += reward.candy
      result.slotCandy[slot]! += reward.candy
      result.slotFamily[slot]! += Number(reward.candy > 0)
      if (item) {
        remaining = Math.max(0, remaining - item.dpr)
        special ||= item.special
        belly ||= !!item.belly
      }
    }
  }
  return result
}

/** Daily limits only change rewards, so reuse the same full simulation across preceding counts. */
export function efficiencyRewardsAfterResearch(result: EfficiencySimulation, researchedBefore = 0): EfficiencyReward {
  return { catch: result.catch, candy: result.slotCandy.reduce((sum, candy, slot) => sum + (researchedBefore + slot >= 10 ? result.slotFamily[slot]! : candy), 0) }
}
export function simulateEfficiencyState(state: EfficiencyDrawState, iterations: number, rng = efficiencyRandom(1)): EfficiencyReward {
  return efficiencyRewardsAfterResearch(simulateEfficiencySlots(state, iterations, rng), state.researchedBefore)
}
