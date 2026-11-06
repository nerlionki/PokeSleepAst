import extracted0 from '../data/skill-tables.resource'
import extracted1 from '../data/client-defaults.resource'
import { cloneData } from './dataClone'
import { clampSkillLevel, skillByPokedexName } from './mainSkills'
import { modelAmount, type ModelContext } from './skillModel'
const skills_config_extracted0 = extracted0.modules.skills
const skills_config_extracted1 = extracted1.modules.skills
const classificationRules = extracted0.modules.mainSkills.execution.classificationRules.map(rule => ({ pattern: new RegExp(rule.pattern), kind: rule.kind as SkillKind }))


export type SkillKind = 'charge' | 'healAll' | 'healOne' | 'healSelf' | 'support' | 'typeAccel' | 'helpAccel' | 'other'

/** 能量填充一类技能直接加到卡比兽身上的能量。 */
export function chargeStrength(mainSkill: string, level: number): number {
  const skill = skillByPokedexName(mainSkill)
  return skill ? modelAmount(skill.model.chargeValue, projectionContext(mainSkill, level)) : 0
}
function projectionContext(name: string, level: number): ModelContext {
  const skill = skillByPokedexName(name)!
  const actor = { pokeId: 0, skill: name, berry: '', energy: 0 }
  return { profile: 'expected', skill, level: clampSkillLevel(name, level), actor, team: [actor], random: () => 0, firstIngredient: '' }
}

export const ACCEL_FACTOR = (skills_config_extracted0.ACCEL_FACTOR as 0.9)
export const ACCEL_MINUTES = (skills_config_extracted0.ACCEL_MINUTES as 120)

export function skillKind(name: string): SkillKind {
  return skillByPokedexName(name)?.model.classification ?? classificationRules.find(rule => rule.pattern.test(name))?.kind ?? 'other'
}

export function skillValue(mainSkill: string, level: number): number {
  const skill = skillByPokedexName(mainSkill)
  return skill ? modelAmount(skill.model.displayValue, projectionContext(mainSkill, level)) : 0
}

export { MAIN_SKILLS as MAIN_SKILL_INFO, MAIN_SKILLS as MAIN_SKILL_DOCS, skillMaxFor } from './mainSkills'

export const SUBSKILL_NOTES: Record<string, string> = (cloneData(skills_config_extracted0.SUBSKILL_NOTES) as unknown as Record<string, string>)

export const RARITY_LABEL = (cloneData(skills_config_extracted1.RARITY_LABEL) as unknown as {readonly "gold":"金";readonly "blue":"蓝";readonly "white":"白"})
