import runtimeParameters from '../data/runtime-parameters.resource'
import { createSleepSelector } from './sleepSelection'
const babyEfficiencyDraw_simulateEfficiencySlots_runtimeParameters = runtimeParameters.modules.babyEfficiencyDraw.simulateEfficiencySlots.values
const babyEfficiencyDraw_efficiencyRewardsAfterResearch_runtimeParameters = runtimeParameters.modules.babyEfficiencyDraw.efficiencyRewardsAfterResearch.values

export interface EfficiencyReward { catch: number, candy: number, firstCandyMultiplier?: number, secondCandyMultiplier?: number }
export interface EfficiencyBucket extends EfficiencyReward {
  count: number
  typed: boolean
  special: boolean
  dpr: number
  spoId?: number
  belly?: boolean
  order?: number
  unlockRank?: number
  weight?: number
  lastRollExcluded?: boolean
}
export interface EfficiencyDrawState {
  buckets: EfficiencyBucket[]
  campTicket?: boolean
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
    return [id, state.power, state.encounters, state.otherSlots, Number(!!state.campTicket), state.researchedBefore ?? 0, JSON.stringify(state.typedFallback), JSON.stringify(state.openFallback)].join(':')
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
export interface EfficiencySimulation extends EfficiencyReward { slotCandy: number[], slotFamily: number[], hitRuns: number, slotSecondCandy?: number[], slotSecondFamily?: number[] }
export function simulateEfficiencySlots(state: EfficiencyDrawState, iterations: number, rng = efficiencyRandom(1)): EfficiencySimulation {
  const totalSlots = state.encounters + Number(!!state.campTicket)
  const campPool = state.campTicket ? state.buckets.filter(bucket => bucket.typed && bucket.dpr <= state.power) : []
  const campCount = campPool.reduce((sum, bucket) => sum + bucket.count, 0)
  const result: EfficiencySimulation = { catch: 0, candy: 0, slotCandy: Array(totalSlots).fill(0), slotFamily: Array(totalSlots).fill(0), hitRuns: 0 }
  if ([...state.buckets, state.typedFallback, state.openFallback].some(reward => reward.firstCandyMultiplier != null || reward.secondCandyMultiplier != null)) {
    result.slotSecondCandy = Array(totalSlots).fill(0); result.slotSecondFamily = Array(totalSlots).fill(0)
  }
  if (state.buckets.every((bucket) => !bucket.catch && !bucket.candy)
    && !state.typedFallback.catch && !state.typedFallback.candy
    && !state.openFallback.catch && !state.openFallback.candy) return result
  // Precompute type, special and belly restriction combinations, outside the Monte Carlo loop.
  let selectors = selectorCache.get(state.buckets)
  if (!selectors) {
    const pools = Array.from({ length: (babyEfficiencyDraw_simulateEfficiencySlots_runtimeParameters.p001 as 8) }, (_, mask) => state.buckets.filter((bucket) =>
    (mask & 1 || bucket.typed) && (!(mask & 2) || !bucket.special) && (!(mask & (babyEfficiencyDraw_simulateEfficiencySlots_runtimeParameters.p002 as 4)) || !bucket.belly)))
    selectors = pools.map((pool) => createSleepSelector(pool, (bucket) => bucket.count * (bucket.weight ?? 1)))
    selectorCache.set(state.buckets, selectors)
  }
  for (let run = 0; run < iterations; run++) {
    let remaining = state.power
    let hit = false
    let special = false, belly = false
    for (let slot = 0; slot < totalSlots; slot++) {
      const camp = slot === state.encounters
      const anyType = !camp && slot < state.otherSlots
      const select: ReturnType<typeof createSleepSelector<EfficiencyBucket>> = selectors[Number(anyType) + Number(special) * 2 + Number(belly) * (babyEfficiencyDraw_simulateEfficiencySlots_runtimeParameters.p003 as 4)]!
      // User-confirmed camp model: uniform per eligible style (bucket multiplicity),
      // initial DPR and unlocked rank, independent of normal weighting/restrictions.
      let item: EfficiencyBucket | undefined
      if (camp) {
        let pick = rng() * campCount
        item = campPool.find(bucket => { pick -= bucket.count; return pick < 0 })
      } else item = select(remaining, slot === state.encounters - 1, rng)
      const reward = item ?? (anyType ? state.openFallback : state.typedFallback)
      result.catch += reward.catch
      hit ||= reward.catch > 0
      const first = reward.firstCandyMultiplier ?? 1, second = reward.secondCandyMultiplier ?? 1
      result.candy += reward.candy * first
      result.slotCandy[slot]! += reward.candy * first
      result.slotFamily[slot]! += Number(reward.candy > 0) * first
      if (result.slotSecondCandy && result.slotSecondFamily) {
        result.slotSecondCandy[slot]! += reward.candy * second
        result.slotSecondFamily[slot]! += Number(reward.candy > 0) * second
      }
      if (item && !camp) {
        remaining = Math.max(0, remaining - item.dpr)
        special ||= item.special
        belly ||= !!item.belly
      }
    }
    result.hitRuns += Number(hit)
  }
  return result
}

/** Daily limits only change rewards, so reuse the same full simulation across preceding counts. */
export function efficiencyRewardsAfterResearch(result: EfficiencySimulation, researchedBefore = 0): EfficiencyReward {
  const candies = researchedBefore > 0 ? result.slotSecondCandy ?? result.slotCandy : result.slotCandy
  const reduced = researchedBefore > 0 ? result.slotSecondFamily ?? result.slotFamily : result.slotFamily
  return { catch: result.catch, candy: candies.reduce((sum, candy, slot) => sum + (researchedBefore + slot >= (babyEfficiencyDraw_efficiencyRewardsAfterResearch_runtimeParameters.p001 as 10) ? reduced[slot]! : candy), 0) }
}
export function simulateEfficiencyState(state: EfficiencyDrawState, iterations: number, rng = efficiencyRandom(1)): EfficiencyReward {
  return efficiencyRewardsAfterResearch(simulateEfficiencySlots(state, iterations, rng), state.researchedBefore)
}
