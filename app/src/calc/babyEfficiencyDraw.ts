/** Ordinary-weight draws can group equivalent styles without changing their distribution. */
export interface EfficiencyReward { catch: number, candy: number }
export interface EfficiencyBucket extends EfficiencyReward {
  count: number
  typed: boolean
  special: boolean
}
export interface EfficiencyDrawState {
  buckets: EfficiencyBucket[]
  encounters: number
  otherSlots: number
  typedFallback: EfficiencyReward
  openFallback: EfficiencyReward
}

export function drawStateKey(state: EfficiencyDrawState): string {
  return JSON.stringify(state)
}

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

/** Return integer totals to make ties independent of floating point addition. */
export function simulateEfficiencyState(
  state: EfficiencyDrawState,
  iterations: number,
  rng: () => number = efficiencyRandom(1),
): EfficiencyReward {
  if (state.buckets.every((bucket) => !bucket.catch && !bucket.candy)
    && !state.typedFallback.catch && !state.typedFallback.candy
    && !state.openFallback.catch && !state.openFallback.candy) return { catch: 0, candy: 0 }

  const counts = new Int32Array(state.buckets.length)
  const initial = Int32Array.from(state.buckets, (bucket) => bucket.count)
  const totalOpen = state.buckets.reduce((sum, bucket) => sum + bucket.count, 0)
  const totalTyped = state.buckets.reduce((sum, bucket) => sum + (bucket.typed ? bucket.count : 0), 0)
  let caught = 0
  let candy = 0
  for (let run = 0; run < iterations; run++) {
    counts.set(initial)
    let open = totalOpen
    let typed = totalTyped
    for (let slot = 0; slot < state.encounters; slot++) {
      const anyType = slot < state.otherSlots
      const total = anyType ? open : typed
      if (total === 0) {
        const fallback = anyType ? state.openFallback : state.typedFallback
        caught += fallback.catch
        candy += fallback.candy
        continue
      }
      let roll = rng() * total
      for (let index = 0; index < counts.length; index++) {
        const bucket = state.buckets[index]!
        if (!counts[index] || (!anyType && !bucket.typed)) continue
        roll -= counts[index]!
        if (roll > 0) continue
        caught += bucket.catch
        candy += bucket.candy
        if (bucket.special) {
          // A special draw removes every special style from both shared pools.
          for (let other = 0; other < counts.length; other++) {
            const candidate = state.buckets[other]!
            if (!candidate.special) continue
            open -= counts[other]!
            if (candidate.typed) typed -= counts[other]!
            counts[other] = 0
          }
        } else {
          counts[index] = counts[index]! - 1
          open--
          if (bucket.typed) typed--
        }
        break
      }
    }
  }
  return { catch: caught, candy }
}
