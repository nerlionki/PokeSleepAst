/** Probability-weighted Otsu compression for one category-limit partition. */
export function clusterSleepBudgets(frontier: Map<number, number>): Map<number, number> {
  const size = frontier.size
  if (size <= 1000) return frontier

  const entries = [...frontier].sort(([a], [b]) => a - b)
  const origin = entries[0]![0]
  const weights = [0], positions = [0], squares = [0]
  for (const [budget, mass] of entries) {
    const position = budget - origin
    weights.push(weights.at(-1)! + mass)
    positions.push(positions.at(-1)! + mass * position)
    squares.push(squares.at(-1)! + mass * position * position)
  }
  const interval = (start: number, end: number) => {
    const weight = weights[end]! - weights[start]!
    const mean = (positions[end]! - positions[start]!) / weight
    const variance = Math.max(0, (squares[end]! - squares[start]!) / weight - mean * mean)
    return { start, end, weight, mean, variance }
  }
  const clusters = [interval(0, size)]
  const limit = Math.ceil(Math.sqrt(5 * size))
  while (clusters.length < limit) {
    let index = -1, variance = 0
    for (const [i, cluster] of clusters.entries()) {
      if (cluster.end - cluster.start > 1 && cluster.variance > variance) {
        index = i
        variance = cluster.variance
      }
    }
    if (index < 0) break
    const { start, end, weight, mean } = clusters[index]!
    const separation = (cut: number) => {
      const left = weights[cut]! - weights[start]!
      if (left <= 0 || left >= weight) return -Infinity
      const delta = (positions[cut]! - positions[start]!) / left - mean
      return delta * delta * left / (weight - left)
    }
    let low = start + 1, high = end - 1
    // The reference selects an Otsu cut by narrowing the search and then checking the remaining cuts.
    while (high - low > 3) {
      const third = (high - low) / 3
      const left = Math.floor(low + third), right = Math.ceil(high - third)
      if (separation(left) < separation(right)) low = left
      else high = right
    }
    let split = low, best = -Infinity
    for (let cut = low; cut <= high; cut++) {
      const score = separation(cut)
      if (score > best) { best = score; split = cut }
    }
    if (!Number.isFinite(best)) break
    clusters.splice(index, 1, interval(start, split), interval(split, end))
  }

  const compressed = new Map<number, number>()
  let clusterIndex = 0, mass = 0, weightedPosition = 0
  const flush = () => {
    if (!mass) return
    const center = Math.round(origin + weightedPosition / mass)
    compressed.set(center, (compressed.get(center) ?? 0) + mass)
    mass = 0
    weightedPosition = 0
  }
  for (const [budget, probability] of entries) {
    const position = budget - origin
    while (clusterIndex + 1 < clusters.length &&
      position >= (clusters[clusterIndex]!.mean + clusters[clusterIndex + 1]!.mean) / 2) {
      flush()
      clusterIndex++
    }
    mass += probability
    weightedPosition += position * probability
  }
  flush()
  return compressed
}
