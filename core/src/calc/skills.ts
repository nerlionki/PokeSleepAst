import extracted0 from '../data/skill-tables.json'
import extracted1 from '../data/client-defaults.json'
import { cloneData } from './dataClone'
import { mainSkillValue, skillByPokedexName } from './mainSkills'
const skills_config_extracted0 = extracted0.modules.skills
const skills_config_extracted1 = extracted1.modules.skills


export type SkillKind = 'charge' | 'healAll' | 'healOne' | 'healSelf' | 'support' | 'typeAccel' | 'helpAccel' | 'other'

/** 能量填充一类技能直接加到卡比兽身上的能量。 */
export function chargeStrength(mainSkill: string, level: number): number {
  const skill = skillByPokedexName(mainSkill)
  if (skill?.id === 18 || skill?.id === 19) return mainSkillValue('能量填充S', level, '能量')
  if (skill?.id === 5) {
    return (mainSkillValue(mainSkill, level, '最低') + mainSkillValue(mainSkill, level, '最高')) / 2
  }
  if (skill?.id === 15) return mainSkillValue(mainSkill, level, '0 层')
  return mainSkillValue(mainSkill, level, '能量')
}

export const ACCEL_FACTOR = (skills_config_extracted0.ACCEL_FACTOR as 0.9)
export const ACCEL_MINUTES = (skills_config_extracted0.ACCEL_MINUTES as 120)

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

export const SUBSKILL_NOTES: Record<string, string> = (cloneData(skills_config_extracted0.SUBSKILL_NOTES) as unknown as Record<string, string>)

export const RARITY_LABEL = (cloneData(skills_config_extracted1.RARITY_LABEL) as unknown as {readonly "gold":"金";readonly "blue":"蓝";readonly "white":"白"})
