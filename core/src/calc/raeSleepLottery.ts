import { clusterSleepBudgets } from './sleepBudgetClusters'
import { createSleepRandom } from './sleepTransition'

/** RAE Worker deployment 484feac. Candidate flags and resolved weights come from the caller's snapshot. */
export interface RaeSleepCandidate {
  internalId: number
  unlockRank: number
  spo: number
  weight: number
  belly: boolean
  legendary: boolean
  leaderExcluded: boolean
  filler: boolean
  target: boolean
  candy: number
  additionalCandy?: readonly [firstReduced: number, second: number, secondReduced: number]
}

export interface RaeSleepQuery {
  spo: number
  naturalSlots: number
  restrictedLeaderChance: number
  typedPool: readonly RaeSleepCandidate[]
  mixedPool?: { slots: number, candidates: readonly RaeSleepCandidate[] }
  campTicket?: boolean
}

export type RaeSleepModel =
  | { precision: 'low', iterations: number, seed?: number, random?: () => number }
  | { precision: 'medium' | 'high', prune?: number, statistic?: 'expectation' | 'first-hit', trace?: RaeTreeTrace }

type TreeStatistic = 'expectation' | 'first-hit'
export interface RaeTreeTransition {
  statistic: TreeStatistic
  slot: number
  stage: 'regular' | 'restricted' | 'full' | 'filler' | 'camp'
  remaining: number
  selectionBudget: number
  bellyLeft: number
  legendaryLeft: number
  stateMass: number
  eligible?: { internalId: number, weight: number }[]
  branches: { internalId: number, weight: number, mass: number }[]
}
export interface RaeTreeFrontier {
  statistic: TreeStatistic
  slot: number
  usedLimits: number
  incomingStates: number
  prunedMass: number
  before: { states: number, mass: number }
  after: { states: number, mass: number }
  representatives?: [budget: number, mass: number][]
}
interface RaeTreeTrace {
  transition?: (entry: RaeTreeTransition) => void
  frontier?: (entry: RaeTreeFrontier) => void
}

interface Outcome { spo: number, limits: number, weight: number, hits: number, candy: number, additionalCandy?: readonly number[] }
interface StyleOutcome extends Outcome { candidate: RaeSleepCandidate, limited: boolean, filler: boolean }
interface WeightedPool<T extends Outcome = Outcome> { outcomes: T[], cumulative: number[] }
interface SlotPool {
  styles: WeightedPool<StyleOutcome>
  buckets: WeightedPool
  rewardPrefixes: number[][]
  fillers: StyleOutcome[]
  fullLeaders: StyleOutcome[]
  limitedLeaders: StyleOutcome[]
}
interface SleepSlot { pools: SlotPool[], kind: 'regular' | 'last' | 'camp', restrictedLeaderChance: number }

function weightedPool<T extends Outcome>(outcomes: T[]): WeightedPool<T> {
  outcomes.sort((a, b) => a.spo - b.spo)
  let weight = 0
  return { outcomes, cumulative: outcomes.map(item => weight += item.weight) }
}

function affordableCount(items: readonly Outcome[], budget: number): number {
  let low = 0, high = items.length
  while (low < high) {
    const middle = (low + high) >>> 1
    if (items[middle]!.spo <= budget) low = middle + 1
    else high = middle
  }
  return low
}

const preparedPools = new WeakMap<readonly RaeSleepCandidate[], SlotPool[]>()

function preparePool(candidates: readonly RaeSleepCandidate[]): SlotPool[] {
  const prepared = preparedPools.get(candidates)
  if (prepared) return prepared
  for (const row of candidates) {
    if (typeof row.filler !== 'boolean' || typeof row.leaderExcluded !== 'boolean') {
      throw new Error('RAE 睡姿抽选资料不完整', { cause: row.internalId })
    }
    if (!Number.isSafeInteger(row.spo) || row.spo < 0 || !Number.isFinite(row.weight) || row.weight < 0) {
      throw new RangeError(`Invalid RAE sleep style cost or weight: ${row.internalId}`)
    }
  }
  const rows = candidates.filter(row => row.weight > 0)
    .sort((a, b) => b.spo - a.spo || Number(b.belly) - Number(a.belly) || a.unlockRank - b.unlockRank || a.internalId - b.internalId)
    .map(row => ({
      spo: row.spo, limits: Number(row.belly) | (Number(row.legendary) << 1), weight: row.weight,
      hits: Number(row.target), candy: row.candy, limited: !row.leaderExcluded && !row.legendary, filler: row.filler,
      candidate: row, additionalCandy: row.additionalCandy,
    }))
  const pools = Array.from({ length: 4 }, (_, usedLimits) => {
    const eligible = rows.filter(row => !(row.limits & usedLimits))
    const buckets = new Map<number, Outcome & { additionalCandy?: number[] }>()
    for (const row of eligible) {
      const key = row.spo * 4 + row.limits
      const bucket = buckets.get(key)
      if (bucket) {
        bucket.weight += row.weight
        bucket.hits += row.hits * row.weight
        bucket.candy += row.candy * row.weight
        if (row.additionalCandy) {
          bucket.additionalCandy ??= [0, 0, 0]
          row.additionalCandy.forEach((amount, index) => { bucket.additionalCandy![index]! += amount * row.weight })
        }
      } else {
        buckets.set(key, { spo: row.spo, limits: row.limits, weight: row.weight,
          hits: row.hits * row.weight, candy: row.candy * row.weight,
          additionalCandy: row.additionalCandy?.map(amount => amount * row.weight) })
      }
    }
    for (const bucket of buckets.values()) {
      bucket.hits /= bucket.weight
      bucket.candy /= bucket.weight
      bucket.additionalCandy = bucket.additionalCandy?.map(amount => amount / bucket.weight)
    }
    const weightedBuckets = weightedPool([...buckets.values()])
    const rewardPrefixes = weightedBuckets.outcomes.reduce<number[][]>((prefixes, row) => {
      const previous = prefixes.at(-1)!
      const rewards = [row.hits, row.candy, ...(row.additionalCandy ?? [0, 0, 0])]
      prefixes.push(rewards.map((reward, index) => previous[index]! + reward * row.weight))
      return prefixes
    }, [[0, 0, 0, 0, 0]])
    return {
      styles: weightedPool([...eligible]),
      buckets: weightedBuckets,
      rewardPrefixes,
      fillers: eligible.filter(row => row.filler),
      fullLeaders: eligible,
      limitedLeaders: eligible.filter(row => row.limited),
    }
  })
  preparedPools.set(candidates, pools)
  return pools
}

function fillerPool(pool: SlotPool): StyleOutcome[] {
  if (!pool.fillers.length) throw new Error('RAE 睡姿抽选缺少符合限额的补位睡姿')
  return pool.fillers
}

const leaderPool = (pool: SlotPool, limited: boolean) => limited ? pool.limitedLeaders : pool.fullLeaders
function leader(pool: SlotPool, budget: number, limited: boolean): StyleOutcome {
  const leaders = leaderPool(pool, limited)
  const selected = leaders.find(row => row.spo <= budget) ?? pool.fillers.find(row => row.spo <= budget)
  if (!selected) throw new Error('RAE 睡姿抽选缺少可负担的末槽候选')
  return selected
}

function sampleSlot(pool: SlotPool, slot: SleepSlot, budget: number, random: () => number): StyleOutcome {
  const { outcomes, cumulative } = pool.styles
  const end = affordableCount(outcomes, budget)
  if (!end) {
    const fillers = fillerPool(pool)
    return fillers[Math.floor(random() * fillers.length)]!
  }
  if (slot.kind === 'last') return leader(pool, budget, random() < slot.restrictedLeaderChance)
  const roll = random() * cumulative[end - 1]!
  let low = 0, high = end - 1
  while (low < high) {
    const middle = (low + high) >>> 1
    if (cumulative[middle]! <= roll) low = middle + 1
    else high = middle
  }
  return outcomes[low]!
}

interface TreeDiagnostics { peakFrontier: number, peakAfterClustering: number, discardedMass: number }

function frontierSize(partitions: Map<number, number>[]): number {
  return partitions.reduce((sum, part) => sum + part.size, 0)
}

function budgetAccumulator(spo: number, slots: SleepSlot[]) {
  if (!Number.isInteger(spo)) return undefined
  const maxFiller = Math.max(0, ...slots.flatMap(slot => slot.pools[0]!.fillers.map(row => row.spo)))
  // A balance can only become negative through an unaffordable filler.
  const offset = maxFiller * slots.length
  const length = spo + offset + 1
  if (length > 180_000) return undefined
  const partitions = Array.from({ length: 4 }, () => ({ values: new Float64Array(length), touched: [] as number[] }))
  return {
    add(partition: number, budget: number, mass: number) {
      const { values, touched } = partitions[partition]!
      const index = budget + offset
      const previous = values[index]!
      if (previous === 0) touched.push(index)
      values[index] = previous + mass
    },
    take() {
      return partitions.map(({ values, touched }) => {
        const frontier = new Map<number, number>()
        for (const index of touched) {
          frontier.set(index - offset, values[index]!)
          values[index] = 0
        }
        touched.length = 0
        return frontier
      })
    },
  }
}

function advanceTree(
  slots: SleepSlot[], spo: number, model: Extract<RaeSleepModel, { precision: 'medium' | 'high' }>,
  statistic: TreeStatistic,
) {
  const prune = model.prune ?? 1e-6
  let frontier = [new Map([[spo, 1]]), new Map<number, number>(), new Map<number, number>(), new Map<number, number>()]
  let probability = 0
  const slotCounts = slots.map(() => 0), slotCandy = slots.map(() => 0)
  const slotAdditionalCandy = slots.map(() => [0, 0, 0])
  const firstHit = statistic === 'first-hit'
  const accumulation = budgetAccumulator(spo, slots)
  const fraction = spo - Math.floor(spo)
  const trace = model.trace
  const diagnostics: TreeDiagnostics = { peakFrontier: 1, peakAfterClustering: 1, discardedMass: 0 }
  for (const [slotIndex, slot] of slots.entries()) {
    const last = slotIndex === slots.length - 1
    const next = accumulation ? undefined : frontier.map(() => new Map<number, number>())
    const pruned = trace?.frontier ? [0, 0, 0, 0] : undefined
    for (const [usedLimits, budgets] of frontier.entries()) {
      const pool = slot.pools[usedLimits]!
      const { outcomes, cumulative } = pool.buckets
      const transfer = (row: Outcome, remaining: number, mass: number) => {
        if (mass <= 0) return
        // Keep the same key after spending integer costs in different orders.
        // Rounded Otsu centers start a new, integral budget path.
        const following = Number.isInteger(remaining)
          ? remaining - row.spo : Math.floor(remaining) - row.spo + fraction
        const partition = usedLimits | row.limits
        if (accumulation) accumulation.add(partition, following, mass)
        else {
          const destination = next![partition]!
          destination.set(following, (destination.get(following) ?? 0) + mass)
        }
      }
      const record = (row: Outcome, remaining: number, mass: number) => {
        const hitMass = mass * row.hits
        if (firstHit) probability += hitMass
        else {
          slotCounts[slotIndex]! += hitMass
          slotCandy[slotIndex]! += mass * row.candy
          row.additionalCandy?.forEach((amount, index) => { slotAdditionalCandy[slotIndex]![index]! += amount * mass })
        }
        if (!last) transfer(row, remaining, firstHit ? mass - hitMass : mass)
      }
      for (const [remaining, mass] of budgets) {
        if (mass <= prune) {
          diagnostics.discardedMass += mass
          if (pruned) pruned[usedLimits]! += mass
          continue
        }
        const budget = slot.kind === 'camp' ? spo : remaining
        const end = affordableCount(outcomes, budget)
        const emit = trace?.transition && ((stage: RaeTreeTransition['stage'], rows: StyleOutcome[], scale: number, uniform = false, candidates = rows) => {
          trace.transition!({ statistic, slot: slotIndex + 1, stage, remaining, selectionBudget: budget,
            bellyLeft: Number(!(usedLimits & 1)), legendaryLeft: Number(!(usedLimits & 2)), stateMass: mass,
            eligible: candidates.map(row => ({ internalId: row.candidate.internalId, weight: uniform && stage === 'filler' ? 1 : row.weight })),
            branches: rows.map(row => ({ internalId: row.candidate.internalId, weight: uniform ? 1 : row.weight,
              mass: scale * (uniform ? 1 : row.weight) })),
          })
        })
        if (!end) {
          const fillers = fillerPool(pool)
          if (emit) emit('filler', fillers, mass / fillers.length, true)
          for (const row of fillers) record(row, remaining, mass / fillers.length)
        } else if (slot.kind === 'last') {
          const chance = slot.restrictedLeaderChance
          if (chance > 0) {
            const row = leader(pool, budget, true)
            if (emit) {
              const candidates = leaderPool(pool, true).filter(item => item.spo <= budget)
              emit('restricted', [row], chance * mass, true, candidates.length ? candidates : [row])
            }
            record(row, remaining, chance * mass)
          }
          if (chance < 1) {
            const row = leader(pool, budget, false)
            if (emit) emit('full', [row], (1 - chance) * mass, true, leaderPool(pool, false).filter(item => item.spo <= budget))
            record(row, remaining, (1 - chance) * mass)
          }
        } else {
          const factor = mass / cumulative[end - 1]!
          if (emit) emit(slot.kind, pool.styles.outcomes.slice(0, affordableCount(pool.styles.outcomes, budget)), factor)
          const rewards = pool.rewardPrefixes[end]!
          if (firstHit) probability += rewards[0]! * factor
          else {
            slotCounts[slotIndex]! += rewards[0]! * factor
            slotCandy[slotIndex]! += rewards[1]! * factor
            const additionalCandy = slotAdditionalCandy[slotIndex]!
            additionalCandy[0]! += rewards[2]! * factor
            additionalCandy[1]! += rewards[3]! * factor
            additionalCandy[2]! += rewards[4]! * factor
          }
          if (last) continue
          for (let index = 0; index < end; index++) {
            const row = outcomes[index]!
            transfer(row, remaining, row.weight * factor * (firstHit ? 1 - row.hits : 1))
          }
        }
      }
    }
    const advanced = accumulation?.take() ?? next!
    diagnostics.peakFrontier = Math.max(diagnostics.peakFrontier, frontierSize(advanced))
    const following = model.precision === 'medium' ? advanced.map(clusterSleepBudgets) : advanced
    if (trace?.frontier) {
      const stats = (states: Map<number, number>) => ({ states: states.size, mass: [...states.values()].reduce((a, b) => a + b, 0) })
      for (const [usedLimits, before] of advanced.entries()) {
        const after = following[usedLimits]!
        trace.frontier({ statistic, slot: slotIndex + 1, usedLimits, incomingStates: frontier[usedLimits]!.size,
          prunedMass: pruned![usedLimits]!, before: stats(before), after: stats(after),
          representatives: before === after ? undefined : [...after].sort(([a], [b]) => a - b) })
      }
    }
    frontier = following
    diagnostics.peakAfterClustering = Math.max(diagnostics.peakAfterClustering, frontierSize(frontier))
  }
  return { slotCounts, slotCandy, slotAdditionalCandy, probability, diagnostics }
}

function prepareSlots(query: RaeSleepQuery): SleepSlot[] {
  const { spo, naturalSlots, typedPool, mixedPool, campTicket, restrictedLeaderChance } = query
  if (!Number.isFinite(spo) || spo < 0 || spo > Number.MAX_SAFE_INTEGER || !Number.isSafeInteger(naturalSlots) || naturalSlots < 1 ||
    !Number.isFinite(restrictedLeaderChance) || restrictedLeaderChance < 0 || restrictedLeaderChance > 1 ||
    (mixedPool && (!Number.isInteger(mixedPool.slots) || mixedPool.slots < 0 || mixedPool.slots > naturalSlots))) {
    throw new RangeError('Invalid RAE sleep lottery query')
  }
  const typed = preparePool(typedPool)
  const mixed = mixedPool?.slots ? preparePool(mixedPool.candidates) : typed
  const slots: SleepSlot[] = Array.from({ length: naturalSlots }, (_, index) => ({
    kind: index === naturalSlots - 1 ? 'last' : 'regular',
    pools: index < (mixedPool?.slots ?? 0) ? mixed : typed,
    restrictedLeaderChance,
  }))
  if (campTicket) slots.push({ kind: 'camp', pools: typed, restrictedLeaderChance })
  return slots
}

export interface RaeSleepPickTrace {
  slot: number
  stage: 'regular' | 'last' | 'filler' | 'camp'
  before: number
  after: number
  budget: number
  eligible: RaeSleepCandidate[]
  chosen: RaeSleepCandidate
}

function drawSlots(slots: SleepSlot[], spo: number, random: () => number, pick: (row: RaeSleepCandidate, index: number) => void, trace?: (detail: RaeSleepPickTrace) => void) {
  let remaining = spo, usedLimits = 0
  for (const [index, slot] of slots.entries()) {
    const camp = slot.kind === 'camp'
    const budget = camp ? spo : remaining
    const pool = slot.pools[usedLimits]!
    const row = sampleSlot(pool, slot, budget, random)
    pick(row.candidate, index)
    if (trace) {
      const usedFiller = affordableCount(pool.styles.outcomes, budget) === 0
      trace({ slot: index, stage: usedFiller ? 'filler' : slot.kind, before: remaining,
        after: camp ? remaining : remaining - row.spo, budget, chosen: row.candidate,
        eligible: (usedFiller ? pool.fillers : pool.styles.outcomes).map(outcome => outcome.candidate) })
    }
    if (!camp) remaining -= row.spo
    usedLimits |= row.limits
  }
}

/** Prepares one ordered draw for callers that compute rewards after selection. */
export function prepareRaeSleepDraw(query: RaeSleepQuery) {
  const slots = prepareSlots(query)
  const { spo } = query
  return (random: () => number, pick: (row: RaeSleepCandidate, index: number) => void, trace?: (detail: RaeSleepPickTrace) => void) =>
    drawSlots(slots, spo, random, pick, trace)
}

/** Both trees use the same transitions as sampling. Pruned branches do not count as hits. */
export function runRaeSleepLottery(query: RaeSleepQuery, model: RaeSleepModel) {
  const { spo } = query
  const slots = prepareSlots(query)

  if (model.precision !== 'low') {
    if (model.prune != null && (!Number.isFinite(model.prune) || model.prune < 0 || model.prune >= 1)) {
      throw new RangeError('Invalid RAE sleep lottery pruning threshold')
    }
    const expected = model.statistic === 'first-hit' ? undefined : advanceTree(slots, spo, model, 'expectation')
    const firstHit = model.statistic === 'expectation' ? undefined : advanceTree(slots, spo, model, 'first-hit')
    return {
      slotCounts: expected?.slotCounts ?? slots.map(() => 0),
      slotCandy: expected?.slotCandy ?? slots.map(() => 0),
      slotAdditionalCandy: expected?.slotAdditionalCandy ?? slots.map(() => [0, 0, 0]),
      probability: Math.min(1, firstHit?.probability ?? 0),
      diagnostics: { expectation: expected?.diagnostics, firstHit: firstHit?.diagnostics },
    }
  }

  const { iterations, seed = 42 } = model
  if (!Number.isSafeInteger(iterations) || iterations < 1 || !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new RangeError('Invalid RAE sleep lottery sampling settings')
  }
  const random = model.random ?? createSleepRandom(seed).next
  const slotCounts = slots.map(() => 0), slotCandy = slots.map(() => 0)
  const slotAdditionalCandy = slots.map(() => [0, 0, 0])
  let hitRuns = 0
  for (let run = 0; run < iterations; run++) {
    let hit = false
    drawSlots(slots, spo, random, (row, index) => {
      slotCounts[index]! += Number(row.target)
      slotCandy[index]! += row.candy
      row.additionalCandy?.forEach((amount, indexOfReward) => { slotAdditionalCandy[index]![indexOfReward]! += amount })
      hit ||= row.target
    })
    hitRuns += Number(hit)
  }
  return {
    slotCounts: slotCounts.map(count => count / iterations), slotCandy: slotCandy.map(candy => candy / iterations),
    slotAdditionalCandy: slotAdditionalCandy.map(rewards => rewards.map(amount => amount / iterations)),
    probability: hitRuns / iterations,
  }
}
