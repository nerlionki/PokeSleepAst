import sleepMap from '../data/sleep-map-mask.json'
import type { IslandId } from '../types'
import { ENCOUNTER_BANDS, ISLANDS, POKEDEX } from './data'
import { mythicalAppear } from './specialty'

const MAP_BITS = sleepMap as unknown as Record<string, { bits?: string }>

/** RAE 地图睡姿里出现过的宝可梦，见 https://pks.raenonx.cc/zh/map */
const MAP_SPECIES = new Map(ISLANDS.map((island) => [
  island.id,
  new Set(String(MAP_BITS[island.id]?.bits ?? '').split(',').filter(Boolean).map((part) => Number(part.split(':')[0]))),
]))

/** 南瓜精 / 南瓜怪人的体型档在地图上共用基础编号。 */
function mapId(pokeId: number): number {
  return pokeId >= 71000 && pokeId < 71200 ? Math.floor(pokeId / 100) : pokeId
}

/** 会在哪些岛出现：RAE 地图有该宝可梦的睡姿，或在本岛出没名单里。 */
export function islandsOf(pokeId: number) {
  const id = mapId(pokeId)
  return ISLANDS.filter((island) => MAP_SPECIES.get(island.id)?.has(id) || island.species.includes(pokeId))
}

/** 在该岛出现的全部宝可梦（含进化型），按图鉴顺序。 */
export function islandPokemon(islandId: IslandId) {
  const island = ISLANDS.find((item) => item.id === islandId)
  const map = MAP_SPECIES.get(islandId)
  return POKEDEX.filter((poke) => map?.has(mapId(poke.id)) || island?.species.includes(poke.id))
}

export function homeText(pokeId: number): string {
  const appear = mythicalAppear(pokeId)
  if (appear) return appear
  return islandsOf(pokeId).map((island) => island.name).join('、') || '仅限活动'
}

export const ISLAND_UNLOCK: Record<IslandId, string> = {
  greengrass: '初始开放',
  cyan: '登录约 50 个睡姿后开放',
  taupe: '登录约 70 个睡姿后开放',
  snowdrop: '登录约 150 个睡姿后开放',
  lapis: '登录约 240 个睡姿后开放',
  powerplant: '登录约 340 个睡姿后开放',
  canyon: '登录约 450 个睡姿后开放',
  greenex: '萌绿之岛评级达到大师18后开放（EX）',
  cyanex: '天青沙滩评级达到大师18后开放（EX2）',
}

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
