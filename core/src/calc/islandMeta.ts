import extracted0 from '../data/calc-tables.resource'
import { cloneData } from './dataClone'
import type { IslandId } from '../types'
import { ENCOUNTER_BANDS, ISLANDS, POKEDEX, SLEEP_STYLES } from './data'
import { activitySleepStyles, createActivityContext, type ActivitySelection } from './activities'
import { mythicalAppear } from './specialty'
const islandMeta_config_extracted0 = extracted0.modules.islandMeta


/** 南瓜精 / 南瓜怪人的体型档在地图上共用基础编号。 */
function mapId(pokeId: number): number {
  return pokeId >= 71000 && pokeId < 71200 ? Math.floor(pokeId / 100) : pokeId
}

/** 会在哪些岛出现：RAE 地图有该宝可梦的睡姿，或在本岛出没名单里。 */
export function islandsOf(pokeId: number, activity?: ActivitySelection) {
  const id = mapId(pokeId)
  const styles = activitySleepStyles(SLEEP_STYLES, createActivityContext('research', activity))
  return ISLANDS.filter((island) => styles.some(style => style.island === island.id && mapId(style.pokeId) === id))
}

/** 在该岛出现的全部宝可梦（含进化型），按图鉴顺序。 */
export function islandPokemon(islandId: IslandId, activity?: ActivitySelection) {
  const ids = new Set(activitySleepStyles(SLEEP_STYLES, createActivityContext('research', activity)).filter(style => style.island === islandId).map(style => style.pokeId))
  return POKEDEX.filter(poke => ids.has(poke.id))
}

export function homeText(pokeId: number, activity?: ActivitySelection): string {
  const appear = mythicalAppear(pokeId)
  if (appear) return appear
  return islandsOf(pokeId, activity).map((island) => island.name).join('、') || '仅限活动'
}

export const ISLAND_UNLOCK: Record<IslandId, string> = (cloneData(islandMeta_config_extracted0.ISLAND_UNLOCK) as unknown as Record<IslandId, string>)

export function islandUnlock(id: IslandId): string {
  return ISLAND_UNLOCK[id] ?? '开放条件未收录'
}

export function islandBands(id: IslandId) {
  const island = ISLANDS.find((i) => i.id === id)
  const key = (island?.band ?? 'greengrass') as keyof typeof ENCOUNTER_BANDS
  return ENCOUNTER_BANDS[key] ?? ENCOUNTER_BANDS.greengrass
}

export function formatDp(n: number | null | undefined): string {
  if (n == null) return '以上'
  return n.toLocaleString('zh-CN')
}
