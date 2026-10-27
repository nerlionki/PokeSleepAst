import ruleParameters from '../data/rule-parameters.json'
import extracted0 from '../data/calc-tables.json'
import { cloneData } from './dataClone'
import { berryByName } from './data'
import { POKEMON_LEVEL_MAX } from './xp'
const berry_config_extracted0 = extracted0.modules.berry
const berry_berryEnergyAt_ruleParameters = ruleParameters.modules.berry.berryEnergyAt


const SNAP = (cloneData(berry_config_extracted0.SNAP) as unknown as readonly [1,10,25,30,50,60,70,80,100])

/** Wiki：线性与复利取较大值再四舍五入；71～100 级为用户保留的规划推算。 */
export function berryEnergyAt(name: string, level: number): number {
  const b = berryByName(name)
  if (!b) return berry_berryEnergyAt_ruleParameters.unknownBerryEnergy
  const lv = Math.min(POKEMON_LEVEL_MAX, Math.max(1, level))
  return Math.round(Math.max(b.energyLv1 + lv - 1, b.energyLv1 * berry_berryEnergyAt_ruleParameters.compoundGrowth ** (lv - 1)))
}

/** 每颗先向上取整营地加成，再乘喜好树果倍率。 */
export function berryUnitEnergy(name: string, level: number, areaBonus: number, favoredMultiplier: number): number {
  return Math.ceil(berryEnergyAt(name, level) * (1 + areaBonus)) * favoredMultiplier
}

export function berryEnergySnaps(name: string) {
  return SNAP.map((level) => ({ level, energy: berryEnergyAt(name, level) }))
}

export function berryEnergyTable(name: string) {
  return Array.from({ length: POKEMON_LEVEL_MAX }, (_, i) => ({ level: i + 1, energy: berryEnergyAt(name, i + 1) }))
}

export { berryImageUrl as berryIconUrl } from './raeImage'
