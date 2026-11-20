import {
  createSleepRandom, sampleSleepBranch,
  type SleepDrawState, type SleepDrawUnresolved, type SleepTransition,
} from './sleepTransition'

interface StudyRun<T> {
  context?: string
  initial: SleepDrawState
  slots: number
  camp: readonly T[]
  transition: SleepTransition<T>
}

function addMass(histogram: number[], count: number, mass: number) {
  histogram[count] = histogram[count]! + mass
}

function moments(histogram: number[]) {
  return {
    sum: histogram.reduce((sum, mass, count) => sum + count * mass, 0),
    sumSquares: histogram.reduce((sum, mass, count) => sum + count * count * mass, 0),
    atLeastOne: histogram.slice(1).reduce((sum, mass) => sum + mass, 0),
  }
}

export function sampleSleepStudy<T>(
  run: StudyRun<T>, target: (style: T) => boolean,
  settings: { samples: number, seed: number, delta?: number, cancelled?: () => boolean },
) {
  const { samples, seed, delta, cancelled } = settings
  if (!Number.isSafeInteger(samples) || samples < 1 || samples > 100_000 || !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff
    || (delta !== undefined && (!Number.isFinite(delta) || delta <= 0 || delta >= 1))) {
    throw new RangeError('Invalid sleep study sampling settings')
  }
  const rng = createSleepRandom(seed)
  const maxCount = run.slots + Number(run.camp.length > 0)
  const histogram = Array<number>(maxCount + 1).fill(0)
  const provenance = { samples, seed, prng: 'mulberry32-v1', delta, context: run.context }
  for (let index = 0; index < samples; index++) {
    if (cancelled?.()) return { kind: 'aborted' as const, completed: index, provenance }
    let count = 0
    let state = run.initial
    while (state.slot < run.slots) {
      const step = run.transition(state)
      if (step.kind === 'unresolved') return { kind: 'unresolved' as const, detail: step, completed: index, provenance }
      const branch = sampleSleepBranch(step.branches, rng.next)!
      count += Number(target(branch.style))
      state = branch.next
    }
    if (run.camp.length) count += Number(target(run.camp[Math.floor(rng.next() * run.camp.length)]!))
    addMass(histogram, count, 1)
  }
  const { sum, sumSquares, atLeastOne } = moments(histogram)
  const mean = sum / samples
  const variance = samples > 1 ? Math.max(0, (sumSquares - sum * mean) / (samples - 1)) : undefined
  const standardError = variance === undefined ? undefined : Math.sqrt(variance / samples)
  const interval = (margin: number): [number, number] => [Math.max(0, mean - margin), Math.min(maxCount, mean + margin)]
  return {
    kind: 'resolved' as const, histogram, completed: samples, sum, sumSquares, mean,
    probabilityAtLeastOne: atLeastOne / samples, variance, standardError, provenance,
    meanInterval95: standardError === undefined ? undefined : interval(1.96 * standardError),
    hoeffdingInterval: delta === undefined ? undefined : interval(maxCount * Math.sqrt(Math.log(2 / delta) / (2 * samples))),
  }
}

interface CountState {
  state: SleepDrawState
  count: number
  probability: number
}

/** Zero quantum and zero pruning compute the full count distribution. */
export function enumerateSleepStudy<T>(
  run: StudyRun<T>, target: (style: T) => boolean,
  settings: { quantum: number, prune: number, maxStates: number, maxEdges: number, cancelled?: () => boolean },
) {
  const { quantum, prune, maxStates, maxEdges, cancelled } = settings
  if (!Number.isSafeInteger(quantum) || quantum < 0 || !Number.isFinite(prune) || prune < 0 || prune >= 1
    || ![maxStates, maxEdges].every(value => Number.isSafeInteger(value) && value > 0)) {
    throw new RangeError('Invalid sleep study enumeration settings')
  }
  const maxCount = run.slots + Number(run.camp.length > 0)
  const histogram = Array<number>(maxCount + 1).fill(0)
  let current: CountState[] = [{ state: run.initial, count: 0, probability: 1 }]
  let edges = 0
  let discardedMass = 0
  let unresolvedMass = 0
  const unresolved: SleepDrawUnresolved[] = []
  for (let slot = 0; slot < run.slots; slot++) {
    const next = new Map<string, CountState>()
    for (const { state, count, probability } of current) {
      if (cancelled?.()) return { kind: 'aborted' as const }
      const step = run.transition(state)
      if (step.kind === 'unresolved') {
        unresolvedMass += probability
        if (unresolved.length < 20) unresolved.push(step)
        continue
      }
      edges += step.branches.length
      if (edges > maxEdges) return { kind: 'limit' as const, resource: 'edges' as const, limit: maxEdges }
      for (const branch of step.branches) {
        const followingCount = count + Number(target(branch.style))
        const following = branch.next
        const bucket = quantum ? Math.floor(following.remaining / quantum) : following.remaining
        const key = `${bucket}:${Number(following.noGauge)}:${Number(following.special)}:${Number(following.belly)}:${followingCount}`
        const mass = probability * branch.probability
        const known = next.get(key)
        if (known) {
          known.probability += mass
          // Keep one reachable budget for the cluster and report the configured quantum.
          if (following.remaining < known.state.remaining) known.state = following
        } else {
          if (next.size >= maxStates) return { kind: 'limit' as const, resource: 'states' as const, limit: maxStates }
          next.set(key, { state: following, count: followingCount, probability: mass })
        }
      }
    }
    current = []
    for (const row of next.values()) {
      if (row.probability < prune) discardedMass += row.probability
      else current.push(row)
    }
  }
  const campChance = run.camp.length ? run.camp.filter(target).length / run.camp.length : 0
  for (const { count, probability } of current) {
    if (campChance < 1) addMass(histogram, count, probability * (1 - campChance))
    if (campChance > 0) addMass(histogram, count + 1, probability * campChance)
  }
  const { sum, atLeastOne } = moments(histogram)
  const missingMass = discardedMass + unresolvedMass
  const diagnostics = { histogram, quantum, prune, discardedMass, unresolvedMass, unresolved, edges, context: run.context }
  if (missingMass > 0) {
    return {
      kind: 'partial' as const, ...diagnostics,
      meanBounds: quantum ? undefined : [sum, sum + maxCount * missingMass],
      probabilityAtLeastOneBounds: quantum ? undefined : [atLeastOne, Math.min(1, atLeastOne + missingMass)],
    }
  }
  return { kind: 'resolved' as const, ...diagnostics, mean: sum, probabilityAtLeastOne: atLeastOne }
}
