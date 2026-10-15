/** Ordinary draws spend DPR; terminal and exhausted draws are deterministic.
 * Terminal exclusions follow the user-approved RAE snapshot in sleep-last-roll-source.json.
 * https://wikiwiki.jp/poke_sleep/睡眠リサーチ/ねむけパワー/寝顔出現の法則
 */
export interface DprCandidate { dpr: number, spoId?: number, order?: number, unlockRank?: number, lastRollExcluded?: boolean }
export function compareSleepPriority(a: DprCandidate, b: DprCandidate): number {
  // User-confirmed 2026-10-15: equal DPR prefers the lower SPO ID.
  // Missing SPO metadata retains the rank/internal-ID fallback.
  return (a.spoId ?? Number.MAX_SAFE_INTEGER) - (b.spoId ?? Number.MAX_SAFE_INTEGER)
    || (a.unlockRank ?? 0) - (b.unlockRank ?? 0) || (a.order ?? 0) - (b.order ?? 0)
}
export function selectSleepStyle<T extends DprCandidate>(
  pool: readonly T[], remaining: number, last: boolean, rng: () => number,
  weight: (item: T) => number = () => 1,
  lowPower = false,
): T | undefined {
  if (last) pool = pool.filter(item => !item.lastRollExcluded)
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
  const terminal = sorted.filter(item => !item.lastRollExcluded)
  const prefix = [0]
  const terminalGroupStart: number[] = []
  for (let i = 0; i < terminal.length; i++) {
    terminalGroupStart.push(i && terminal[i]!.dpr === terminal[i - 1]!.dpr ? terminalGroupStart[i - 1]! : i)
  }
  for (let i = 0; i < sorted.length; i++) {
    prefix.push(prefix[i]! + weight(sorted[i]!))
  }
  return (remaining: number, last: boolean, rng: () => number, lowPower = false): T | undefined => {
    if (last) {
      if (!terminal.length || lowPower) return terminal[0]
      let lo = 0, hi = terminal.length
      while (lo < hi) { const mid = (lo + hi) >>> 1; if (terminal[mid]!.dpr <= remaining) lo = mid + 1; else hi = mid }
      if (!lo) return terminal[0]
      return terminal[terminalGroupStart[lo - 1]!]
    }
    if (!sorted.length || lowPower) return sorted[0]
    let lo = 0, hi = sorted.length
    while (lo < hi) { const mid = (lo + hi) >>> 1; if (sorted[mid]!.dpr <= remaining) lo = mid + 1; else hi = mid }
    const end = lo
    if (!end) return sorted[0]
    const roll = rng() * prefix[end]!
    lo = 0; hi = end - 1
    while (lo < hi) { const mid = (lo + hi) >>> 1; if (prefix[mid + 1]! <= roll) lo = mid + 1; else hi = mid }
    return sorted[lo]
  }
}
