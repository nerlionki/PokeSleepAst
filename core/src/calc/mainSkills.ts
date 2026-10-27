import skillRouting from '../data/compatibility-maps.json'
import extracted0 from '../data/skill-tables.json'
import { cloneData } from './dataClone'
import { foldText } from './text'
const mainSkills_config_extracted0 = extracted0.modules.mainSkills


export interface SkillTable {
  title?: string
  columns: string[]
  levels: string[][]
}

export interface MainSkill {
  id: number
  group: string
  name: string
  aliases: string[]
  maxLevel: number
  summary: string
  detail: string
  columns: string[]
  levels: string[][]
  extra?: SkillTable[]
}

export const SKILL_GROUPS = (cloneData(mainSkills_config_extracted0.SKILL_GROUPS) as unknown as readonly ["能量","梦之碎片","活力","额外帮忙","额外掉落","额外技能","料理","特殊"])

// Table provenance retained: RAE mainSkillEffectMap[41], verified 2026-10-26; see rae-misdreavus-source.json.
export const MAIN_SKILLS: MainSkill[] = (cloneData(mainSkills_config_extracted0.MAIN_SKILLS) as unknown as MainSkill[])

const exactSkills = new Map<string, MainSkill>()
const foldedSkills = new Map<string, MainSkill>()
for (const skill of MAIN_SKILLS) {
  for (const name of [skill.name, ...skill.aliases]) {
    if (!exactSkills.has(name)) exactSkills.set(name, skill)
    const folded = foldText(name)
    if (!foldedSkills.has(folded)) foldedSkills.set(folded, skill)
  }
}
const SELECT_ALIAS = foldText(skillRouting.modules.mainSkills.selectAlias)
const PLUS_ALIAS = foldText(skillRouting.modules.mainSkills.plusAlias)

export function skillByPokedexName(name: string, pokeId?: number): MainSkill | undefined {
  // 模拟每次发动会多次查询，固定名称与别名只折叠一次。
  if (pokeId == null && exactSkills.has(name)) return exactSkills.get(name)
  const folded = foldText(name)
  // 同名技能依物种分流；使用唯一规范名的复制/挥指保持选中的变体。
  if (folded === SELECT_ALIAS) {
    const id = (skillRouting.modules.mainSkills.selectByPokemon as Record<string, number>)[String(pokeId)] ?? skillRouting.modules.mainSkills.selectDefault
    return MAIN_SKILLS.find(skill => skill.id === id)
  }
  if (folded === PLUS_ALIAS && pokeId === skillRouting.modules.mainSkills.plusPokemon) return MAIN_SKILLS.find(skill => skill.id === skillRouting.modules.mainSkills.plusSkill)
  return exactSkills.get(name) ?? foldedSkills.get(folded)
}

export function skillMaxFor(name: string): number {
  return skillByPokedexName(name)?.maxLevel ?? skillRouting.modules.mainSkills.unknownSkillMaxLevel
}

export function clampSkillLevel(name: string, level: number): number {
  return Math.min(skillMaxFor(name), Math.max(1, Math.floor(level) || 1))
}

/** 当前技能对应等级的指定数值列；缺少该效果时为 0。 */
export function mainSkillValue(name: string, level: number, column: string): number {
  const skill = skillByPokedexName(name)
  if (!skill) return 0
  const index = skill.columns.indexOf(column)
  if (index < 0) return 0
  return Number(skill.levels[clampSkillLevel(name, level) - 1]?.[index]) || 0
}
