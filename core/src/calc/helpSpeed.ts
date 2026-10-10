import type { IslandId } from '../types'
import { islandById, natureByName } from './data'
import { POKEMON_LEVEL_MAX } from './xp'

export function energyMultiplier(energy: number): number {
  if (energy >= 80) return 0.45
  if (energy >= 60) return 0.52
  if (energy >= 40) return 0.58
  if (energy >= 20) return 0.66
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

export function levelInterval(base: number, level: number, nature: string, subskills: string[], helpingBonus: number): number {
  const lv = Math.min(POKEMON_LEVEL_MAX, Math.max(1, level))
  const raw = base * ((501 - lv) / 500) * natureHelpFactor(nature) * (1 - subskillSpeedCut(subskills, helpingBonus))
  return Math.max(1, Math.floor(raw))
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
  const camp = goodCamp ? 0.8 : 1
  const ribbon = 1 - Math.min(0.25, Math.max(0, ribbonCut))
  return Math.max(1, Math.round(levelInterval(base, level, nature, subskills, helpingBonus) * energyMultiplier(energy) * camp * ex * ribbon))
}
