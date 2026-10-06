import { mainSkillValue, skillByPokedexName } from './mainSkills'

export type SkillKind = 'charge' | 'healAll' | 'healOne' | 'healSelf' | 'support' | 'typeAccel' | 'helpAccel' | 'other'

/** 能量填充一类技能直接加到卡比兽身上的能量。 */
export function chargeStrength(mainSkill: string, level: number): number {
  const skill = skillByPokedexName(mainSkill)
  if (skill?.id === 5) {
    return (mainSkillValue(mainSkill, level, '最低') + mainSkillValue(mainSkill, level, '最高')) / 2
  }
  if (skill?.id === 15) return mainSkillValue(mainSkill, level, '0 层')
  return mainSkillValue(mainSkill, level, '能量')
}

export const ACCEL_FACTOR = 0.9
export const ACCEL_MINUTES = 120

export function skillKind(name: string): SkillKind {
  if (/属性加速|屬性加速|加速（属性）|加速（屬性）/.test(name)) return 'typeAccel'
  if (/帮手加速|幫手加速/.test(name)) return 'helpAccel'
  if (/帮手支援|幫手支援/.test(name)) return 'support'
  if (/全体|全體|月光|新月/.test(name)) return 'healAll'
  if (/疗愈S|療癒S|治愈波动|治癒波動/.test(name)) return 'healOne'
  if (/活力填充|树果汁|樹果汁|蹭蹭/.test(name)) return 'healSelf'
  if (/能量填充|蓄力|梦魇|夢魘|波导弹|波導彈|精神击破|精神擊破/.test(name)) return 'charge'
  return 'other'
}

export function skillValue(mainSkill: string, level: number): number {
  const kind = skillKind(mainSkill)
  if (kind === 'charge') return chargeStrength(mainSkill, level)
  if (kind === 'healAll' || kind === 'healOne' || kind === 'healSelf') {
    return mainSkillValue(mainSkill, level, '活力') || mainSkillValue(mainSkill, level, '自己')
  }
  if (kind === 'support') return mainSkillValue(mainSkill, level, '帮忙')
  return 0
}

export { MAIN_SKILLS as MAIN_SKILL_INFO, MAIN_SKILLS as MAIN_SKILL_DOCS, skillMaxFor } from './mainSkills'

export const SUBSKILL_NOTES: Record<string, string> = {
  berryS: '每次帮忙的树果数量 +1',
  sleepExp: '睡眠获得的 EXP +14%',
  helpingBonus: '全队帮忙间隔 −5%（最多叠加 5 次）',
  researchExp: '研究 EXP +6%',
  shardBonus: '梦之碎片 +6%',
  skillLevelM: '主技能等级 +2',
  energyRecover: '活力回复量 +14%',
  helpM: '帮忙间隔 −14%',
  ingM: '食材发现率 +36%',
  invL: '持有上限 +18',
  invM: '持有上限 +12',
  skillM: '主技能发动率 +36%',
  skillLevelS: '主技能等级 +1',
  helpS: '帮忙间隔 −7%',
  ingS: '食材发现率 +18%',
  invS: '持有上限 +6',
  skillS: '主技能发动率 +18%',
}

export const RARITY_LABEL = { gold: '金', blue: '蓝', white: '白' } as const
