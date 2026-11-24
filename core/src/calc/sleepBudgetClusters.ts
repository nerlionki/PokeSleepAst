/** Range sums use compensated, chunk-local prefixes so nearby cuts keep their precision. */
function rangeSums(values: number[]) {
  const width = 2 ** Math.ceil(Math.log2(Math.max(64, Math.sqrt(values.length))))
  const prefix = (input: number[], start: number, end: number) => {
    const sums = [0]
    let sum = 0, error = 0
    for (let i = start; i < end; i++) {
      const value = input[i]!
      const next = sum + value
      error += Math.abs(sum) >= Math.abs(value) ? sum - (next - value) : value - (next - sum)
      sum = next
      sums.push(sum + error)
    }
    return sums
  }
  const chunks: number[][] = []
  for (let start = 0; start < values.length; start += width) {
    chunks.push(prefix(values, start, Math.min(values.length, start + width)))
  }
  const offsets = prefix(chunks.map(chunk => chunk.at(-1)!), 0, chunks.length)
  return (start: number, end: number): number => {
    const first = Math.floor(start / width)
    const last = Math.floor((end - 1) / width)
    const within = chunks[last]![(end - 1) % width + 1]! - chunks[first]![start % width]!
    return offsets[last]! - offsets[first]! + within
  }
}

/** The reference normalizes probabilities before computing its weighted moments. */
function pairwiseSum(values: number[], start = 0, end = values.length): number {
  if (end - start <= 16) {
    let sum = 0
    for (let index = start; index < end; index++) sum += values[index]!
    return sum
  }
  const mid = Math.floor((start + end) / 2)
  return pairwiseSum(values, start, mid) + pairwiseSum(values, mid, end)
}

/** RAE Worker 484feac Otsu compression, checked against deployment 63315b1 captures. */
export function clusterSleepBudgets(frontier: Map<number, number>): Map<number, number> {
  const size = frontier.size
  if (size <= 1000) return frontier

  const entries = [...frontier].sort(([a], [b]) => a - b)
  const origin = entries[0]![0]
  const total = pairwiseSum(entries.map(([, mass]) => mass))
  if (total <= 0) return new Map()
  const scale = 1 / total
  const weights = entries.map(([, mass]) => mass * scale)
  const positions = entries.map(([budget]) => budget - origin)
  const weightedPositions = positions.map((position, index) => position * weights[index]!)
  const center = pairwiseSum(weightedPositions)
  const weight = rangeSums(weights)
  const position = rangeSums(weightedPositions)
  const square = rangeSums(positions.map((value, index) => weights[index]! * (value - center) * (value - center)))
  const mean = (start: number, end: number) => position(start, end) / weight(start, end) + origin
  const interval = (start: number, end: number) => {
    const mass = weight(start, end)
    const average = position(start, end) * (1 / mass) - center
    const variance = Math.max(0, square(start, end) * (1 / mass) - average * average)
    return { start, end, mass: mass * total, mean: mean(start, end), variance }
  }
  const clusters = [interval(0, size)]
  const limit = Math.ceil(Math.sqrt(5 * size))
  while (clusters.length < limit) {
    let index = -1, variance = -1
    for (const [i, cluster] of clusters.entries()) {
      // An all-zero interval has undefined variance. Keep the reference's
      // comparison order, because those intervals still affect the split.
      if (cluster.variance <= variance) continue
      index = i
      variance = cluster.variance
    }
    if (index < 0) break
    const cluster = clusters[index]!
    if (cluster.variance === 0 || cluster.end - cluster.start === 1) break
    const score = (cut: number) => {
      const left = weight(cluster.start, cut) * total
      const delta = cluster.mean - mean(cluster.start, cut)
      return delta * delta * (left / (cluster.mass - left))
    }
    let low = cluster.start + 1, high = cluster.end
    while (high - low > 3) {
      const third = (high - low) / 3
      const left = Math.floor(low + third), right = Math.ceil(high - third)
      if (score(left) < score(right)) low = left
      else high = right
    }
    let split = low, best = -Infinity
    for (let cut = low; cut <= high; cut++) {
      const value = score(cut)
      if (value > best) { best = value; split = cut }
    }
    if (split >= cluster.end) break
    clusters.splice(index, 1, interval(cluster.start, split), interval(split, cluster.end))
  }

  const compressed = new Map<number, number>()
  let clusterIndex = 0, members = 0, mass = 0, weightedPosition = 0
  const flush = () => {
    if (!members) return
    const center = mass ? Math.round(weightedPosition / mass) : 0
    compressed.set(center, (compressed.get(center) ?? 0) + mass)
    mass = 0
    members = 0
    weightedPosition = 0
  }
  for (const [budget, probability] of entries) {
    while (clusterIndex + 1 < clusters.length &&
      budget >= 0.5 * (clusters[clusterIndex]!.mean + clusters[clusterIndex + 1]!.mean)) {
      flush()
      clusterIndex++
    }
    members++
    mass += probability
    weightedPosition += budget * probability
  }
  flush()
  return compressed
}
