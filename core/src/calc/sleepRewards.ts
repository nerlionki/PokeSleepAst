/** RAE 睡姿图鉴的逐睡姿奖励：https://pks.raenonx.cc/zh/sleepdex/lookup */
import rewards from '../data/sleep-rewards.json'

export interface SleepReward {
  researchExp: number
  shards: number
  candy: number
}

const byId = new Map(rewards.map((row) => [row.id, row]))
const bySpeciesAndStars = new Map<string, (typeof rewards)[number]>()
for (const row of rewards) {
  const key = `${row.pokeId}-${row.stars}`
  if (!bySpeciesAndStars.has(key)) bySpeciesAndStars.set(key, row)
}

/** RAE 睡姿内码优先；普通睡姿用宝可梦与星级定位。 */
export function sleepReward(style: { pokeId: number, stars: number, styleId?: number }): SleepReward | undefined {
  return (style.styleId != null ? byId.get(style.styleId) : undefined)
    ?? bySpeciesAndStars.get(`${style.pokeId}-${style.stars}`)
}

/** Original game sleep-style order, independent of per-island generated row IDs. */
export function sleepStyleInternalId(style: { pokeId: number, stars: number, styleId?: number }): number {
  return style.styleId ?? bySpeciesAndStars.get(`${style.pokeId}-${style.stars}`)?.id ?? Number.MAX_SAFE_INTEGER
}
