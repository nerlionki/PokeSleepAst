import type { ProduceInput } from '../types'
import { MAIN_SKILLS, skillByPokedexName } from './mainSkills'
import { pokeById } from './data'

/** 出处：https://pks.raenonx.cc/zh/mainskill/info/34 */
export const MEW_SKILLS = [
  { id: 12, multiplier: 1 }, { id: 5, multiplier: 1.6 }, { id: 7, multiplier: 1.6 },
  { id: 4, multiplier: 1.097770154373928 }, { id: 2, multiplier: 1 }, { id: 6, multiplier: 1 },
  { id: 9, multiplier: 1 }, { id: 10, multiplier: 1 }, { id: 11, multiplier: 1 },
  { id: 13, multiplier: 1 }, { id: 8, multiplier: 0.8421052631578947 }, { id: 20, multiplier: 0.7111111111111111 },
].map(choice => ({ ...choice, rate: pokeById(151)!.skillRate * choice.multiplier, name: MAIN_SKILLS.find(skill => skill.id === choice.id)!.name }))

export function normalizeMewSkill(id: unknown): number {
  return MEW_SKILLS.find(choice => choice.id === id)?.id ?? 12
}

export function resolveMemberSkill(poke: { id: number, mainSkill: string, skillRate: number }, input: Pick<ProduceInput, 'mewSkill'>) {
  if (poke.id !== 151) return { name: skillByPokedexName(poke.mainSkill, poke.id)?.name ?? poke.mainSkill, rate: poke.skillRate }
  const choice = MEW_SKILLS.find(skill => skill.id === normalizeMewSkill(input.mewSkill))!
  return { name: choice.name, rate: poke.skillRate * choice.multiplier }
}
