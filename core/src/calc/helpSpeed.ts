import type { IslandId } from '../types'
import { islandById, natureByName } from './data'
import { POKEMON_LEVEL_MAX } from './xp'

export function energyMultiplier(energy: number): number {
  if (energy > 80) return 0.45
  if (energy > 60) return 0.52
  if (energy > 40) return 0.58
  // 用户确认：0～1 的小数活力暂按正活力档；Wiki 对此边界仍待验证。
  if (energy > 0) return 0.66
  return 1
}

export function natureHelpFactor(nature: string): number {
  const n = natureByName(nature)
  if (n.up === 'help') return 0.9
  if (n.down === 'help') return 1.075
  return 1
}

export function subskillSpeedCut(subskills: string[], helpingBonus: number): number {
  let cut = 0
  if (subskills.includes('helpS')) cut += 0.07
  if (subskills.includes('helpM')) cut += 0.14
  cut += Math.min(5, Math.max(0, helpingBonus)) * 0.05
  return Math.min(0.35, cut)
}

function intervalMultiplier(level: number, nature: string, subskills: string[], helpingBonus: number, ribbonCut: number): number {
  const lv = Math.min(POKEMON_LEVEL_MAX, Math.max(1, level))
  return ((501 - lv) / 500) * natureHelpFactor(nature) * (1 - subskillSpeedCut(subskills, helpingBonus)) * (1 - Math.min(0.25, Math.max(0, ribbonCut)))
}

/** 显示间隔：勋章与其余显示补正合并后统一向下取整。 */
export function levelInterval(base: number, level: number, nature: string, subskills: string[], helpingBonus: number, ribbonCut = 0): number {
  return Math.max(1, Math.floor(base * intervalMultiplier(level, nature, subskills, helpingBonus, ribbonCut)))
}

export function instantInterval(
  base: number,
  level: number,
  nature: string,
  subskills: string[],
  helpingBonus: number,
  energy: number,
  goodCamp: boolean,
  islandId: IslandId,
  favored: boolean,
  ribbonCut = 0,
  exOverride?: number,
): number {
  const island = islandById(islandId)
  const ex = exOverride ?? (favored ? island?.helpFavored ?? 1 : island?.helpUnfavored ?? 1)
  const camp = goodCamp ? 1 / 1.2 : 1
  // RAE 总倍率先截断四位小数，再向下取整秒数；不复用已经取整的显示间隔。
  // https://pks.raenonx.cc/en/docs/view/technical/helping-frequency
  // 露营券：https://hackmd.io/@raenonx-pokemon-sleep/Byb1J4rx-l
  const multiplier = intervalMultiplier(level, nature, subskills, helpingBonus, ribbonCut) * energyMultiplier(energy) * camp * ex
  const truncated = Math.floor(multiplier * 10000 + 1e-10) / 10000
  return Math.max(1, Math.floor(base * truncated + 1e-10))
}
