import defaultMemberConfig from '../data/client-defaults.resource'
import ruleParameters from '../data/rule-parameters.resource'
import extracted0 from '../data/calc-tables.resource'
import { cloneData } from './dataClone'
import type { MemberTune, ProduceInput } from '../types'
import { clampSkillLevel, skillMaxFor } from './mainSkills'
import { pokeById } from './data'
import { evolutionDepth, evolutionStages } from './evolution'
const member_config_extracted0 = extracted0.modules.member
const member_compareHelpingBonus_ruleParameters = ruleParameters.modules.member.compareHelpingBonus
const member_subskillLevelBonus_ruleParameters = ruleParameters.modules.member.subskillLevelBonus
const member_applySilverSeed_ruleParameters = ruleParameters.modules.member.applySilverSeed
const member_wakeFromHours_ruleParameters = ruleParameters.modules.member.wakeFromHours


export type { MemberTune }

export const SUBSKILL_GATES = (cloneData(member_config_extracted0.SUBSKILL_GATES) as unknown as readonly [10,25,50,70,80])

export interface MemberDraft extends ProduceInput {
  tune: MemberTune
}

export function defaultTune(): MemberTune {
  return cloneData(defaultMemberConfig.modules.factory_member.defaultTune) as MemberTune
}

/** 同链切换用于个体规划；保留面板配置，按阶段差联动进化次数与主技能等级。 */
export function switchMemberEvolution<T extends MemberDraft>(member: T, pokeId: number): T {
  if (member.pokeId === pokeId) return member
  const stages = evolutionStages(member.pokeId)
  const targetDepth = stages.findIndex(stage => stage.some(node => node.id === pokeId))
  const target = pokeById(pokeId)
  if (targetDepth < 0 || !target) return member
  const depth = evolutionDepth(member.pokeId)
  const delta = targetDepth - depth
  const evolutions = Math.min(targetDepth, Math.max(0, Math.min(depth, member.tune.evolutions) + delta))
  const skill = stepSkillLevel({ skillLevel: member.skillLevel, goldSeeds: member.tune.goldSeeds }, member.skillLevel + delta, skillMaxFor(target.mainSkill))
  return { ...member, pokeId, skillLevel: skill.skillLevel,
    tune: { ...member.tune, evolutions, goldSeeds: skill.goldSeeds } }
}

/** 调整实际经历的进化次数，同时增减主技能等级。 */
export function stepMemberEvolutions<T extends MemberDraft>(member: T, delta: number): T {
  const evolutions = Math.min(evolutionDepth(member.pokeId), Math.max(0, member.tune.evolutions + delta))
  if (evolutions === member.tune.evolutions) return member
  const skill = stepSkillLevel({ skillLevel: member.skillLevel, goldSeeds: member.tune.goldSeeds },
    member.skillLevel + evolutions - member.tune.evolutions, skillMaxFor(pokeById(member.pokeId)?.mainSkill ?? ''))
  return { ...member, skillLevel: skill.skillLevel,
    tune: { ...member.tune, evolutions, goldSeeds: skill.goldSeeds } }
}

export function exclusiveSubskills<T extends { id: string }>(catalog: T[], selected: string[], index: number): T[] {
  const taken = new Set(selected.filter((id, slot) => id && slot !== index))
  return catalog.filter((item) => !taken.has(item.id))
}

export function unlockedSubskills(level: number, subskills: string[]): string[] {
  return subskills.filter((id, index) => Boolean(id) && level >= (SUBSKILL_GATES[index] ?? 1))
}

/** 个体对比里，这只自己带着帮手奖励时，按满队 5 层（25%）计算。 */
export function compareHelpingBonus(level: number, subskills: string[], fallback: number): number {
  return unlockedSubskills(level, subskills).includes('helpingBonus') ? member_compareHelpingBonus_ruleParameters.teamSize : fallback
}

interface SkillSeeds {
  skillLevel: number
  goldSeeds: number
}

/** 每颗金种子（主技能种子）让主技能 +1，满级后不能再用。 */
export function stepGoldSeed(current: SkillSeeds, delta: number, skillMax: number, subskillLevels = 0): SkillSeeds | null {
  const goldSeeds = current.goldSeeds + delta
  const skillLevel = current.skillLevel + delta
  if (goldSeeds < 0 || skillLevel < 1 || skillLevel > skillMax) return null
  if (delta > 0 && skillLevel + subskillLevels > skillMax) return null
  return { skillLevel, goldSeeds }
}

export function subskillLevelBonus(level: number, subskills: string[]): number {
  const subs = unlockedSubskills(level, subskills)
  return (subs.includes('skillLevelS') ? member_subskillLevelBonus_ruleParameters.skillLevelS : 0) + (subs.includes('skillLevelM') ? member_subskillLevelBonus_ruleParameters.skillLevelM : 0)
}

const SUBSKILL_UPGRADES: Record<string, string> = (cloneData(member_config_extracted0.SUBSKILL_UPGRADES) as unknown as Record<string, string>)

/** 只允许已解锁副技能升一档；目标不能与任何槽位（包括未解锁）重复。 */
export function silverSeedCandidates(level: number, subskills: string[]) {
  return subskills.flatMap((from, index) => {
    const to = SUBSKILL_UPGRADES[from]
    return to && level >= (SUBSKILL_GATES[index] ?? Infinity) && !subskills.includes(to) ? [{ index, from, to }] : []
  })
}

export function applySilverSeed(member: MemberDraft, index: number): MemberDraft | null {
  const candidate = silverSeedCandidates(member.level, member.subskills).find(item => item.index === index)
  if (!candidate || member.tune.silverSeeds >= member_applySilverSeed_ruleParameters.legacySilverSeedCap) return null
  const subskills = [...member.subskills]
  subskills[index] = candidate.to
  return { ...member, subskills, tune: { ...member.tune, silverSeeds: member.tune.silverSeeds + 1,
    silverSeedHistory: [...(member.tune.silverSeedHistory ?? []), candidate] } }
}

export function undoSilverSeed(member: MemberDraft): MemberDraft | null {
  const history = member.tune.silverSeedHistory ?? []
  const last = history.at(-1)
  if (member.tune.silverSeeds <= 0) return null
  if (last && member.subskills[last.index] !== last.to) return null
  const subskills = [...member.subskills]
  if (last) subskills[last.index] = last.from
  return { ...member, subskills, tune: { ...member.tune, silverSeeds: member.tune.silverSeeds - 1, silverSeedHistory: history.slice(0, -1) } }
}

/** 金种子提升过的等级不能被降掉，降级时一并退回种子。 */
export function stepSkillLevel(current: SkillSeeds, level: number, skillMax: number): SkillSeeds {
  const skillLevel = Math.min(skillMax, Math.max(1, level))
  return { skillLevel, goldSeeds: Math.min(current.goldSeeds, skillLevel - 1) }
}

/** 主技能等级加上已解锁的技能等级提升 S/M，再按该技能表封顶。 */
export function effectiveSkillLevel(level: number, skillLevel: number, subskills: string[], mainSkill: string): number {
  const lv = Math.max(1, skillLevel) + subskillLevelBonus(level, subskills)
  return clampSkillLevel(mainSkill, lv)
}

/** 共眠小时换算起床活力。0 小时表示跟随全队睡眠分数。8.5 小时约为 100。 */
export function wakeFromHours(hours: number): number | undefined {
  if (!hours) return undefined
  return Math.min(member_wakeFromHours_ruleParameters.energyCap, Math.max(0, Math.round((hours * 60) / member_wakeFromHours_ruleParameters.minutesPerScore)))
}
