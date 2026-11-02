import { defaultSkillLevel } from './member'
import model from '../data/sp-model.json'
import { NATURES, ingredientByName, pokeById } from './data'
import { berryEnergyAt } from './berry'
import { ingredientColumns, slotDrop } from './ingredients'
import { skillByPokedexName } from './mainSkills'
import { subskillLevelBonus, unlockedSubskills } from './member'
import { natureHelpFactor } from './helpSpeed'
import { ribbonBonus, stagesLeft } from './ribbon'
import { GAME_LEVEL_MAX, POKEMON_LEVEL_MAX } from './xp'
import type { BoxPokemon, IngredientSlots } from '../types'

/** skillLevel is the displayed, effective level, already including subskill bonuses.
 * SP follows nitoyon's model, not the production simulator (no camp/event/team/pity).
 * Model provenance and the deliberate truncation order are in sp-model.json.
 */
export interface SpInput {
  pokeId: number
  level: number
  nature: string
  subskills: string[]
  ingredientSlots: IngredientSlots
  skillLevel: number
  ribbonHours: number
}
export interface SpResult {
  total: number
  berry: number
  ingredient: number
  skill: number
  frequency: number
  helps: number
  ingredientRate: number
  skillRate: number
  bonus: number
  skillLevel: number
  skillValue: number
  estimated: boolean
}
// Stabilize the original model's decimal truncation without flooring 1.14 as 1.13.
function trunc(value: number, digits: number) {
  const scale = 10 ** digits
  return Math.floor(Number((value * scale).toFixed(6))) / scale
}

export function defaultSpInput(pokeId = model.defaults.pokeId): SpInput {
  const poke = pokeById(pokeId)
  if (!poke) throw Error('请选择有效的宝可梦')
  const columns = ingredientColumns(poke.ingredients)
  return { ...model.defaults, pokeId, subskills: [...model.defaults.subskills],
    ingredientSlots: columns.map((column, index) => column.find(cell => cell.index === model.defaults.ingredientSlots[index])?.index ?? column[0]?.index ?? null) as IngredientSlots,
    skillLevel: defaultSkillLevel(pokeId) }
}

/** Editor/Box skillLevel is the base level; add unlocked subskills exactly once. */
export function spInputFromMember(pokemon: Pick<BoxPokemon, 'pokeId' | 'level' | 'nature' | 'subskills' | 'ingredientSlots' | 'skillLevel' | 'tune'>): SpInput {
  const poke = pokeById(pokemon.pokeId)
  const skill = poke && skillByPokedexName(poke.mainSkill, poke.id)
  return { pokeId: pokemon.pokeId, level: pokemon.level, nature: pokemon.nature,
    subskills: [...pokemon.subskills], ingredientSlots: [...pokemon.ingredientSlots],
    skillLevel: Math.min(skill?.maxLevel ?? 1, pokemon.skillLevel + subskillLevelBonus(pokemon.level, pokemon.subskills)),
    ribbonHours: pokemon.tune?.ribbonHours ?? 0 }
}

export const spInputFromBox = spInputFromMember

export function calculateSp(input: SpInput): SpResult {
  const poke = pokeById(input.pokeId)
  if (!poke || poke.interval <= 0) throw Error('该宝可梦暂无可计算的帮忙资料')
  if (!Number.isInteger(input.level) || input.level < 1 || input.level > POKEMON_LEVEL_MAX) throw Error('请选择有效的宝可梦等级')
  const nature = NATURES.find(row => row.name === input.nature)
  if (!nature) throw Error('请选择有效的性格')
  const skill = skillByPokedexName(poke.mainSkill, poke.id)
  if (!skill || !Number.isInteger(input.skillLevel) || input.skillLevel < 1 || input.skillLevel > skill.maxLevel) throw Error('请选择有效的实际主技能等级')
  const skillValue = (model.skillValues as Record<string, number[]>)[skill.id]?.[input.skillLevel - 1]
  if (skillValue == null) throw Error('该主技能等级暂无 SP 估值资料')
  const subs = unlockedSubskills(input.level, input.subskills)
  const speedCut = (subs.includes('helpS') ? .07 : 0) + (subs.includes('helpM') ? .14 : 0)
  const ribbon = ribbonBonus(input.ribbonHours, stagesLeft(poke.id))
  const frequency = poke.interval * trunc(((501 - input.level) / 500) * natureHelpFactor(input.nature) * (1 - ribbon.speedCut) * (1 - speedCut), 4)
    - (input.level === 10 && poke.interval === 2600 ? .1 : 0)
  const helps = 5 * trunc(3600 / frequency, 2)
  const rate = (base: number, stat: 'ingredient' | 'skill', small: string, medium: string) => trunc(base
    * (nature.up === stat ? 1.2 : nature.down === stat ? .8 : 1)
    * (1 + (subs.includes(small) ? .18 : 0) + (subs.includes(medium) ? .36 : 0)), 4)
  const ingredientRate = rate(poke.ingredientRate, 'ingredient', 'ingS', 'ingM')
  const skillRate = rate(poke.skillRate, 'skill', 'skillS', 'skillM')
  let ingredientEnergy = 0, count = 0
  for (let slot = 0; slot < 3; slot++) {
    if (input.level < [1, 30, 60][slot]!) continue
    const index = input.ingredientSlots[slot]
    if (index == null && poke.specialty === '全部' && slot > 0) continue
    const cell = index == null ? null : ingredientColumns(poke.ingredients)[slot]?.find(cell => cell.index === index)
    if (!cell || !slotDrop(poke.ingredients, slot, cell.index)) throw Error(`请选择有效的 Lv.${[1, 30, 60][slot]} 食材`)
    const ingredient = ingredientByName(cell.name)
    if (!ingredient) throw Error('缺少食材基础能量资料')
    ingredientEnergy += ingredient.energy * cell.amount
    count++
  }
  ingredientEnergy = Math.floor(ingredientEnergy / count)
  const bonusRules = model.bonus
  const subBonus = subs.reduce((sum, id) => sum + ((bonusRules.inventory as Record<string, number>)[id] ?? 0)
    + (bonusRules.teamSubskills.includes(id) ? bonusRules.team : 0), 1)
  const bonus = trunc((nature.up === 'energy' ? bonusRules.energyUp : nature.down === 'energy' ? bonusRules.energyDown : 1) * subBonus, 2)
  const berries = (poke.specialty === '树果型' || poke.specialty === '全部' ? 2 : 1) + Number(subs.includes('berryS'))
  const berry = trunc(helps * (1 - ingredientRate) * berryEnergyAt(poke.berry, input.level) * berries, 2)
  const ingredient = trunc(helps * ingredientRate * ingredientEnergy * model.ingredientGrowth[input.level - 1]!, 2)
  const skillSp = trunc(helps * skillRate * skillValue, 2)
  // Upstream truncates each raw component first, then applies the common bonus.
  const cents = (value: number) => Number((value * 100).toFixed(6))
  return { total: Math.round((cents(berry) + cents(ingredient) + cents(skillSp)) * cents(bonus) / 10000),
    berry: trunc(berry * bonus, 1), ingredient: trunc(ingredient * bonus, 1), skill: trunc(skillSp * bonus, 1),
    frequency, helps, ingredientRate, skillRate, bonus, skillLevel: input.skillLevel, skillValue,
    estimated: input.level > GAME_LEVEL_MAX }
}
