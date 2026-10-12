import type { MemberTune, ProduceInput } from '../types'
import { clampSkillLevel } from './mainSkills'

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
export function stepGoldSeed(current: SkillSeeds, delta: number, skillMax: number, subskillLevels = 0): SkillSeeds | null {
  const goldSeeds = current.goldSeeds + delta
  const skillLevel = current.skillLevel + delta
  if (goldSeeds < 0 || skillLevel < 1 || skillLevel > skillMax) return null
  if (delta > 0 && skillLevel + subskillLevels > skillMax) return null
  return { skillLevel, goldSeeds }
}

export function subskillLevelBonus(level: number, subskills: string[]): number {
  const subs = unlockedSubskills(level, subskills)
  return (subs.includes('skillLevelS') ? 1 : 0) + (subs.includes('skillLevelM') ? 2 : 0)
}

const SUBSKILL_UPGRADES: Record<string, string> = {
  helpS: 'helpM', ingS: 'ingM', skillS: 'skillM', skillLevelS: 'skillLevelM', invS: 'invM', invM: 'invL',
}

/** 只允许已解锁副技能升一档；目标不能与任何槽位（包括未解锁）重复。 */
export function silverSeedCandidates(level: number, subskills: string[]) {
  return subskills.flatMap((from, index) => {
    const to = SUBSKILL_UPGRADES[from]
    return to && level >= (SUBSKILL_GATES[index] ?? Infinity) && !subskills.includes(to) ? [{ index, from, to }] : []
  })
}

export function applySilverSeed(member: MemberDraft, index: number): MemberDraft | null {
  const candidate = silverSeedCandidates(member.level, member.subskills).find(item => item.index === index)
  if (!candidate || member.tune.silverSeeds >= 9) return null
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
  return Math.min(150, Math.max(0, Math.round((hours * 60) / 5.1)))
}
