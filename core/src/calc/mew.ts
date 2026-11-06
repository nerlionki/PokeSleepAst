import extracted0 from '../data/skill-tables.resource'
import { cloneData } from './dataClone'
import type { ProduceInput } from '../types'
import { MAIN_SKILLS, skillByPokedexName } from './mainSkills'
import { pokeById } from './data'
const mew_config_extracted0 = extracted0.modules.mew


/** 出处：https://pks.raenonx.cc/zh/mainskill/info/34 */
export const MEW_SKILLS = cloneData(mew_config_extracted0.MEW_SKILLS).map(choice => ({ ...choice, rate: pokeById(mew_config_extracted0.ownerPokemonId)!.skillRate * choice.multiplier, name: MAIN_SKILLS.find(skill => skill.id === choice.id)!.name }))

export function normalizeMewSkill(id: unknown): number {
  return MEW_SKILLS.find(choice => choice.id === id)?.id ?? mew_config_extracted0.defaultSkillId
}

export function resolveMemberSkill(poke: { id: number, mainSkill: string, skillRate: number }, input: Pick<ProduceInput, 'mewSkill'>) {
  if (poke.id !== mew_config_extracted0.ownerPokemonId) return { name: skillByPokedexName(poke.mainSkill, poke.id)?.name ?? poke.mainSkill, rate: poke.skillRate }
  const choice = MEW_SKILLS.find(skill => skill.id === normalizeMewSkill(input.mewSkill))!
  return { name: choice.name, rate: poke.skillRate * choice.multiplier }
}
