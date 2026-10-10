import type { ProduceInput } from '../types'
import { MAIN_SKILLS } from './mainSkills'

/** 出处：https://pks.raenonx.cc/zh/mainskill/info/34 */
export const MEW_SKILLS = [
  { id: 12, rate: 0.04 }, { id: 5, rate: 0.064 }, { id: 7, rate: 0.064 },
  { id: 4, rate: 0.0439 }, { id: 2, rate: 0.04 }, { id: 6, rate: 0.04 },
  { id: 9, rate: 0.04 }, { id: 10, rate: 0.04 }, { id: 11, rate: 0.04 },
  { id: 13, rate: 0.04 }, { id: 8, rate: 0.0337 }, { id: 20, rate: 0.0284 },
].map(choice => ({ ...choice, name: MAIN_SKILLS.find(skill => skill.id === choice.id)!.name }))

export function normalizeMewSkill(id: unknown): number {
  return MEW_SKILLS.find(choice => choice.id === id)?.id ?? 12
}

export function resolveMemberSkill(poke: { id: number, mainSkill: string, skillRate: number }, input: Pick<ProduceInput, 'mewSkill'>) {
  if (poke.id !== 151) return { name: poke.mainSkill, rate: poke.skillRate }
  const choice = MEW_SKILLS.find(skill => skill.id === normalizeMewSkill(input.mewSkill))!
  return { name: choice.name, rate: choice.rate }
}
