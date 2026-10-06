import { berryByName } from './data'
import { POKEMON_LEVEL_MAX } from './xp'

const SNAP = [1, 10, 25, 30, 50, 60, 70, 80, 100] as const

/** 每级 ×1.025 后取整。energyHigh 是 70 级的值，70 级以后继续按同一复利涨到等级上限。 */
export function berryEnergyAt(name: string, level: number): number {
  const b = berryByName(name)
  if (!b) return 30
  const lv = Math.min(POKEMON_LEVEL_MAX, Math.max(1, level))
  return Math.round(b.energyLv1 * 1.025 ** (lv - 1))
}

export function berryEnergySnaps(name: string) {
  return SNAP.map((level) => ({ level, energy: berryEnergyAt(name, level) }))
}

export function berryEnergyTable(name: string) {
  return Array.from({ length: POKEMON_LEVEL_MAX }, (_, i) => ({ level: i + 1, energy: berryEnergyAt(name, i + 1) }))
}

export { berryImageUrl as berryIconUrl } from './raeImage'
