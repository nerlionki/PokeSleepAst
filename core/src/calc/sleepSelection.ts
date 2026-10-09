/** Wiki model: ordinary draws spend DPR; terminal and exhausted draws are deterministic.
 * https://wikiwiki.jp/poke_sleep/睡眠リサーチ/ねむけパワー/寝顔出現の法則
 */
export interface DprCandidate { dpr: number, order?: number, unlockRank?: number }
export function compareSleepPriority(a: DprCandidate, b: DprCandidate): number {
  return (a.unlockRank ?? 0) - (b.unlockRank ?? 0) || (a.order ?? 0) - (b.order ?? 0)
}
export function selectSleepStyle<T extends DprCandidate>(
  pool: readonly T[], remaining: number, last: boolean, rng: () => number,
  weight: (item: T) => number = () => 1,
  lowPower = false,
): T | undefined {
  if (!pool.length) return undefined
  let minimum = pool[0]!, maximum: T | undefined
  for (const item of pool) {
    if (item.dpr < minimum.dpr || (item.dpr === minimum.dpr && compareSleepPriority(item, minimum) < 0)) minimum = item
    if (item.dpr <= remaining && (!maximum || item.dpr > maximum.dpr || (item.dpr === maximum.dpr && compareSleepPriority(item, maximum) < 0))) maximum = item
  }
  if (lowPower || !maximum) return minimum
  if (last) return maximum
  const eligible = pool.filter(item => item.dpr <= remaining)
  let roll = rng() * eligible.reduce((sum, item) => sum + weight(item), 0)
  for (const item of eligible) { roll -= weight(item); if (roll < 0) return item }
  return eligible.at(-1)
}

/** Compiled equivalent for large efficiency searches: O(log N) per random draw. */
export function createSleepSelector<T extends DprCandidate>(pool: readonly T[], weight: (item: T) => number = () => 1) {
  const sorted = [...pool].sort((a, b) => a.dpr - b.dpr || compareSleepPriority(a, b))
  const prefix = [0]
  const groupStart: number[] = []
  for (let i = 0; i < sorted.length; i++) {
    prefix.push(prefix[i]! + weight(sorted[i]!))
    groupStart.push(i && sorted[i]!.dpr === sorted[i - 1]!.dpr ? groupStart[i - 1]! : i)
  }
  return (remaining: number, last: boolean, rng: () => number, lowPower = false): T | undefined => {
    if (!sorted.length || lowPower) return sorted[0]
    let lo = 0, hi = sorted.length
    while (lo < hi) { const mid = (lo + hi) >>> 1; if (sorted[mid]!.dpr <= remaining) lo = mid + 1; else hi = mid }
    const end = lo
    if (!end) return sorted[0]
    if (last) return sorted[groupStart[end - 1]!]
    const roll = rng() * prefix[end]!
    lo = 0; hi = end - 1
    while (lo < hi) { const mid = (lo + hi) >>> 1; if (prefix[mid + 1]! <= roll) lo = mid + 1; else hi = mid }
    return sorted[lo]
  }
}
