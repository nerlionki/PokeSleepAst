import ruleParameters from '../data/rule-parameters.resource'
import { runRaeSleepLottery, type RaeSleepCandidate } from './raeSleepLottery'
import { raeSpoBudget, raeSpoCost } from './sleepLastRoll'
import { createSleepRandom } from './sleepTransition'
import { RAE_RESTRICTED_LEADER_CHANCE, UP_WEIGHTS } from './sleepRules'

export interface EfficiencyReward { catch: number, candy: number, firstCandyMultiplier?: number, secondCandyMultiplier?: number }
export interface EfficiencyBucket extends EfficiencyReward {
  typed: boolean
  special: boolean
  dpr: number
  belly?: boolean
  order?: number
  unlockRank?: number
  weight?: number
  lastRollExcluded?: boolean
  filler?: boolean
}
export interface EfficiencyDrawState {
  buckets: EfficiencyBucket[]
  campTicket?: boolean
  researchedBefore?: number
  power: number
  encounters: number
  otherSlots: number
}

export function createDrawStateKey() {
  const arrays = new WeakMap<EfficiencyBucket[], number>()
  const signatures = new Map<string, number>()
  return (state: EfficiencyDrawState) => {
    let id = arrays.get(state.buckets)
    if (id == null) {
      const signature = JSON.stringify(state.buckets)
      id = signatures.get(signature) ?? signatures.size
      signatures.set(signature, id)
      arrays.set(state.buckets, id)
    }
    return [id, raeSpoBudget(state.power), state.encounters, state.otherSlots, Number(!!state.campTicket)].join(':')
  }
}

export function efficiencyRandom(seed: number): () => number {
  return createSleepRandom(seed).next
}

export interface EfficiencySimulation extends EfficiencyReward {
  slotCandy: number[]
  slotFamily: number[]
  hitRuns: number
  slotSecondCandy: number[]
  slotSecondFamily: number[]
}

const candidateCache = new WeakMap<EfficiencyBucket[], { typed: RaeSleepCandidate[], mixed: RaeSleepCandidate[] }>()
function efficiencyCandidates(buckets: EfficiencyBucket[]) {
  const cached = candidateCache.get(buckets)
  if (cached) return cached
  const typed: RaeSleepCandidate[] = []
  const mixed = buckets.map((row, index): RaeSleepCandidate => {
    const first = row.firstCandyMultiplier ?? 1
    const second = row.secondCandyMultiplier ?? 1
    const reduced = row.candy > 0 ? ruleParameters.modules.sleepRewards.dailyResearchReward.reducedCandy : 0
    const candidate: RaeSleepCandidate = {
      internalId: row.order ?? index + 1, unlockRank: row.unlockRank ?? 0, spo: raeSpoCost(row.dpr),
      weight: row.weight ?? UP_WEIGHTS.normal, belly: Boolean(row.belly), legendary: row.special,
      leaderExcluded: Boolean(row.lastRollExcluded), filler: row.filler === true, target: row.catch > 0,
      candy: row.candy * first, additionalCandy: [reduced * first, row.candy * second, reduced * second],
    }
    if (row.typed) typed.push(candidate)
    return candidate
  })
  const pools = { typed, mixed }
  candidateCache.set(buckets, pools)
  return pools
}

export function simulateEfficiencySlots(
  state: EfficiencyDrawState, iterations: number, random = efficiencyRandom(42), precision: 'low' | 'medium' | 'high' = 'low',
  statistic?: 'expectation' | 'first-hit',
): EfficiencySimulation {
  const naturalSlots = state.encounters
  const slots = naturalSlots + Number(!!state.campTicket)
  if (!state.buckets.some(row => row.catch > 0 || row.candy > 0)) {
    const zeros = Array<number>(slots).fill(0)
    return { catch: 0, candy: 0, hitRuns: 0, slotCandy: zeros, slotFamily: zeros, slotSecondCandy: zeros, slotSecondFamily: zeros }
  }
  const pool = efficiencyCandidates(state.buckets)
  const result = runRaeSleepLottery({
    spo: raeSpoBudget(state.power), naturalSlots, campTicket: state.campTicket, restrictedLeaderChance: RAE_RESTRICTED_LEADER_CHANCE,
    typedPool: pool.typed,
    mixedPool: state.otherSlots ? { slots: state.otherSlots, candidates: pool.mixed } : undefined,
  }, precision === 'low' ? { precision, iterations, random } : { precision, statistic })
  const sum = (values: number[]) => values.reduce((total, amount) => total + amount, 0) * iterations
  return {
    catch: sum(result.slotCounts), candy: sum(result.slotCandy), hitRuns: result.probability * iterations,
    slotCandy: result.slotCandy.map(value => value * iterations),
    slotFamily: result.slotAdditionalCandy.map(values => values[0]! * iterations),
    slotSecondCandy: result.slotAdditionalCandy.map(values => values[1]! * iterations),
    slotSecondFamily: result.slotAdditionalCandy.map(values => values[2]! * iterations),
  }
}

/** The daily threshold changes reward, without affecting the draw or probability. */
export function efficiencyRewardsAfterResearch(result: EfficiencySimulation, researchedBefore = 0): EfficiencyReward {
  const threshold = ruleParameters.modules.sleepRewards.dailyResearchReward.defaultFullRewardLimit
  const candies = researchedBefore > 0 ? result.slotSecondCandy : result.slotCandy
  const reduced = researchedBefore > 0 ? result.slotSecondFamily : result.slotFamily
  return { catch: result.catch, candy: candies.reduce((sum, candy, slot) => sum + (researchedBefore + slot >= threshold ? reduced[slot]! : candy), 0) }
}

export function simulateEfficiencyState(state: EfficiencyDrawState, iterations: number, random = efficiencyRandom(42), precision: 'low' | 'medium' | 'high' = 'low'): EfficiencyReward {
  return efficiencyRewardsAfterResearch(simulateEfficiencySlots(state, iterations, random, precision), state.researchedBefore)
}
