import runtimeParameters from '../data/runtime-parameters.json'
import ruleParameters from '../data/rule-parameters.json'
import type { IslandId } from '../types'
import { islandById, natureByName } from './data'
import { POKEMON_LEVEL_MAX } from './xp'
const helpSpeed_energyMultiplier_ruleParameters = ruleParameters.modules.helpSpeed.energyMultiplier
const helpSpeed_natureHelpFactor_ruleParameters = ruleParameters.modules.helpSpeed.natureHelpFactor
const helpSpeed_subskillSpeedCut_ruleParameters = ruleParameters.modules.helpSpeed.subskillSpeedCut
const helpSpeed_intervalMultiplier_ruleParameters = ruleParameters.modules.helpSpeed.intervalMultiplier
const helpSpeed_instantInterval_ruleParameters = ruleParameters.modules.helpSpeed.instantInterval
const helpSpeed_instantInterval_runtimeParameters = runtimeParameters.modules.helpSpeed.instantInterval.values


export function energyMultiplier(energy: number): number {
  if (energy > helpSpeed_energyMultiplier_ruleParameters.highEnergyThreshold) return helpSpeed_energyMultiplier_ruleParameters.highEnergyInterval
  if (energy > helpSpeed_energyMultiplier_ruleParameters.mediumEnergyThreshold) return helpSpeed_energyMultiplier_ruleParameters.mediumEnergyInterval
  if (energy > helpSpeed_energyMultiplier_ruleParameters.lowEnergyThreshold) return helpSpeed_energyMultiplier_ruleParameters.lowEnergyInterval
  // 用户确认：0～1 的小数活力暂按正活力档；Wiki 对此边界仍待验证。
  if (energy > 0) return helpSpeed_energyMultiplier_ruleParameters.positiveEnergyInterval
  return 1
}

export function natureHelpFactor(nature: string): number {
  const n = natureByName(nature)
  if (n.up === 'help') return helpSpeed_natureHelpFactor_ruleParameters.fasterInterval
  if (n.down === 'help') return helpSpeed_natureHelpFactor_ruleParameters.slowerInterval
  return 1
}

export function subskillSpeedCut(subskills: string[], helpingBonus: number): number {
  let cut = 0
  if (subskills.includes('helpS')) cut += helpSpeed_subskillSpeedCut_ruleParameters.helpS
  if (subskills.includes('helpM')) cut += helpSpeed_subskillSpeedCut_ruleParameters.helpM
  cut += Math.min(helpSpeed_subskillSpeedCut_ruleParameters.maxHelpingBonuses, Math.max(0, helpingBonus)) * helpSpeed_subskillSpeedCut_ruleParameters.helpingBonus
  return Math.min(helpSpeed_subskillSpeedCut_ruleParameters.maxReduction, cut)
}

function intervalMultiplier(level: number, nature: string, subskills: string[], helpingBonus: number, ribbonCut: number): number {
  const lv = Math.min(POKEMON_LEVEL_MAX, Math.max(1, level))
  return ((helpSpeed_intervalMultiplier_ruleParameters.levelNumerator - lv) / helpSpeed_intervalMultiplier_ruleParameters.levelDenominator) * natureHelpFactor(nature) * (1 - subskillSpeedCut(subskills, helpingBonus)) * (1 - Math.min(helpSpeed_intervalMultiplier_ruleParameters.maxRibbonReduction, Math.max(0, ribbonCut)))
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
  const camp = goodCamp ? 1 / helpSpeed_instantInterval_ruleParameters.campSpeedFactor : 1
  // RAE 总倍率先截断四位小数，再向下取整秒数；不复用已经取整的显示间隔。
  // https://pks.raenonx.cc/en/docs/view/technical/helping-frequency
  // 露营券：https://hackmd.io/@raenonx-pokemon-sleep/Byb1J4rx-l
  const multiplier = intervalMultiplier(level, nature, subskills, helpingBonus, ribbonCut) * energyMultiplier(energy) * camp * ex
  const truncated = Math.floor(multiplier * (helpSpeed_instantInterval_runtimeParameters.p001 as 10000) + 1e-10) / (helpSpeed_instantInterval_runtimeParameters.p002 as 10000)
  return Math.max(1, Math.floor(base * truncated + 1e-10))
}
