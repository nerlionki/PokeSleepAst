import type { MemberTune, ProduceInput } from '../types'

export type { MemberTune }

export const SUBSKILL_GATES = [10, 25, 50, 70, 80] as const

export interface MemberDraft extends ProduceInput {
  tune: MemberTune
}

export function defaultTune(): MemberTune {
  return { evolutions: 0, goldSeeds: 0, silverSeeds: 0, sleepHours: 0, carryMode: 'preset', exp: 0, ribbonHours: 0 }
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
  return unlockedSubskills(level, subskills).includes('helpingBonus') ? 5 : fallback
}

interface SkillSeeds {
  skillLevel: number
  goldSeeds: number
}

/** 每颗金种子（主技能种子）让主技能 +1，满级后不能再用。 */
export function stepGoldSeed(current: SkillSeeds, delta: number, skillMax: number): SkillSeeds | null {
  const goldSeeds = current.goldSeeds + delta
  const skillLevel = current.skillLevel + delta
  if (goldSeeds < 0 || skillLevel < 1 || skillLevel > skillMax) return null
  return { skillLevel, goldSeeds }
}

/** 金种子提升过的等级不能被降掉，降级时一并退回种子。 */
export function stepSkillLevel(current: SkillSeeds, level: number, skillMax: number): SkillSeeds {
  const skillLevel = Math.min(skillMax, Math.max(1, level))
  return { skillLevel, goldSeeds: Math.min(current.goldSeeds, skillLevel - 1) }
}

/** 主技能等级加上已解锁的技能等级提升 S/M。 */
export function effectiveSkillLevel(level: number, skillLevel: number, subskills: string[]): number {
  const subs = unlockedSubskills(level, subskills)
  let lv = Math.max(1, skillLevel)
  if (subs.includes('skillLevelS')) lv += 1
  if (subs.includes('skillLevelM')) lv += 2
  return lv
}

/** 共眠小时换算起床活力。0 小时表示跟随全队睡眠分数。8.5 小时约为 100。 */
export function wakeFromHours(hours: number): number | undefined {
  if (!hours) return undefined
  return Math.min(150, Math.max(0, Math.round((hours * 60) / 5.1)))
}
