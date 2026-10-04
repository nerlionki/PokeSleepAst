import left from '../data/evolution-left.json'

const STAGES = [
  { hours: 2000, carry: 8, speed: [0, 0.12, 0.25] },
  { hours: 1000, carry: 6, speed: [0, 0.05, 0.11] },
  { hours: 500, carry: 3, speed: [0, 0.05, 0.11] },
  { hours: 200, carry: 1, speed: [0, 0, 0] },
] as const

const LEFT = left as Record<string, number>

export const RIBBON_HOURS = [0, 200, 500, 1000, 2000] as const

/** 还能再进化几次。最终形态是 0，不会因为勋章缩短帮忙间隔。 */
export function stagesLeft(pokeId: number): number {
  return LEFT[String(pokeId)] ?? 0
}

/** 睡饱饱勋章。持有是累计值，间隔缩短只看还能进化的次数。 */
export function ribbonBonus(hours: number, remainingEvolutions: number): { carry: number, speedCut: number } {
  const stage = STAGES.find((item) => hours >= item.hours)
  if (!stage) return { carry: 0, speedCut: 0 }
  const index = Math.min(2, Math.max(0, remainingEvolutions))
  return { carry: stage.carry, speedCut: stage.speed[index] ?? 0 }
}
