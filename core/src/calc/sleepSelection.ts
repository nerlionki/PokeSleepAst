/** Rules: https://pks.raenonx.cc/zh/docs/view/help/sleep-styles
 * Ordinary draws consume DPR; repeats are allowed. Extra encounters must use a
 * separate budget. Exact ordinary probabilities remain unconfirmed by the source.
 */
export interface DprCandidate { dpr: number, order?: number }
export function selectSleepStyle<T extends DprCandidate>(
  pool: readonly T[], remaining: number, last: boolean, rng: () => number,
  weight: (item: T) => number = () => 1,
  lowPower = false,
): T | undefined {
  if (!pool.length) return undefined
  if (lowPower) return pool.reduce((best, item) => item.dpr < best.dpr
    || (item.dpr === best.dpr && (item.order ?? 0) < (best.order ?? 0)) ? item : best)
  let minimum = Infinity, maximum = -Infinity
  for (const item of pool) {
    minimum = Math.min(minimum, item.dpr)
    if (item.dpr <= remaining) maximum = Math.max(maximum, item.dpr)
  }
  const accepts = (item: T) => maximum === -Infinity ? item.dpr === minimum
    : last ? item.dpr === maximum : item.dpr <= remaining
  let total = 0
  for (const item of pool) if (accepts(item)) total += weight(item)
  let roll = rng() * total
  let final: T | undefined
  for (const item of pool) {
    if (!accepts(item)) continue
    final = item
    roll -= weight(item)
    if (roll < 0) return item
  }
  return final
}

/** Compiled equivalent for large efficiency searches: O(log N) per draw. */
export function createSleepSelector<T extends DprCandidate>(pool: readonly T[], weight: (item: T) => number = () => 1) {
  const sorted = [...pool].sort((a, b) => a.dpr - b.dpr || (a.order ?? 0) - (b.order ?? 0))
  const prefix = [0]
  for (const item of sorted) prefix.push(prefix[prefix.length - 1]! + weight(item))
  const upper = (value: number) => {
    let lo = 0, hi = sorted.length
    while (lo < hi) { const mid = (lo + hi) >>> 1; if (sorted[mid]!.dpr <= value) lo = mid + 1; else hi = mid }
    return lo
  }
  const groupStart: number[] = []
  for (let i = 0; i < sorted.length; i++) groupStart.push(i && sorted[i]!.dpr === sorted[i - 1]!.dpr ? groupStart[i - 1]! : i)
  const minimumEnd = sorted.length ? upper(sorted[0]!.dpr) : 0
  return (remaining: number, last: boolean, rng: () => number, lowPower = false): T | undefined => {
    if (!sorted.length || lowPower) return sorted[0]
    let end = upper(remaining), start = 0
    if (!end) end = minimumEnd
    else if (last) start = groupStart[end - 1]!
    const roll = prefix[start]! + rng() * (prefix[end]! - prefix[start]!)
    let lo = start, hi = end - 1
    while (lo < hi) { const mid = (lo + hi) >>> 1; if (prefix[mid + 1]! <= roll) lo = mid + 1; else hi = mid }
    return sorted[lo]
  }
}
