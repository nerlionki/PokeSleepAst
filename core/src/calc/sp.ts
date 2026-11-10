import { defaultSkillLevel } from './member'
import skillTables from '../data/skill-tables.resource'
import ruleParameters from '../data/rule-parameters.resource'
import { NATURES, NEUTRAL_NATURE, ingredientById, pokeById } from './data'
import { berryEnergyAt } from './berry'
import { INGREDIENT_GATES, ingredientColumns, slotDrop } from './ingredients'
import { skillByPokedexName } from './mainSkills'
import { subskillLevelBonus, unlockedSubskills } from './member'
import { natureHelpFactor } from './helpSpeed'
import { natureStatFactor, withEffectiveNature } from './natureLabels'
import { ribbonBonus, stagesLeft } from './ribbon'
import { GAME_LEVEL_MAX, POKEMON_LEVEL_MAX } from './xp'
import type { BoxPokemon, IngredientSlots } from '../types'

// Skill estimates and subskill bonuses belong to the same resource snapshot as the catalogs.
const skillModel = skillTables.modules.sp
const model = skillModel
const formula = model.formula
const speedRules = ruleParameters.modules.helpSpeed.subskillSpeedCut
const findingRules = ruleParameters.modules.produce.findingRate

/** skillLevel is the displayed, effective level, already including subskill bonuses.
 * SP follows nitoyon's model, not the production simulator (no camp/event/team/pity).
 * All model tables, defaults and configurable formula parameters come from the launch resource snapshot.
 */
export interface SpInput {
  pokeId: number
  level: number
  nature: string
  natureMinted?: boolean
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
  return { ...model.defaults, nature: NEUTRAL_NATURE, pokeId, subskills: [...model.defaults.subskills],
    ingredientSlots: columns.map((column, index) => column.find(cell => cell.index === model.defaults.ingredientSlots[index])?.index ?? column[0]?.index ?? null) as IngredientSlots,
    skillLevel: defaultSkillLevel(pokeId) }
}

/** Editor/Box skillLevel is the base level; add unlocked subskills exactly once. */
export function spInputFromMember(pokemon: Pick<BoxPokemon, 'pokeId' | 'level' | 'nature' | 'natureMinted' | 'subskills' | 'ingredientSlots' | 'skillLevel' | 'tune'>): SpInput {
  const poke = pokeById(pokemon.pokeId)
  const skill = poke && skillByPokedexName(poke.mainSkill, poke.id)
  return { pokeId: pokemon.pokeId, level: pokemon.level, nature: pokemon.nature,
    ...(pokemon.natureMinted === true ? { natureMinted: true } : {}),
    subskills: [...pokemon.subskills], ingredientSlots: [...pokemon.ingredientSlots],
    skillLevel: Math.min(skill?.maxLevel ?? 1, pokemon.skillLevel + subskillLevelBonus(pokemon.level, pokemon.subskills)),
    ribbonHours: pokemon.tune?.ribbonHours ?? 0 }
}

export const spInputFromBox = spInputFromMember

export function calculateSp(input: SpInput): SpResult {
  input = withEffectiveNature(input)
  const poke = pokeById(input.pokeId)
  if (!poke || poke.interval <= 0) throw Error('该宝可梦暂无可计算的帮忙资料')
  if (!Number.isInteger(input.level) || input.level < 1 || input.level > POKEMON_LEVEL_MAX) throw Error('请选择有效的宝可梦等级')
  const nature = NATURES.find(row => row.name === input.nature)
  if (!nature) throw Error('请选择有效的性格')
  const skill = skillByPokedexName(poke.mainSkill, poke.id)
  if (!skill || !Number.isInteger(input.skillLevel) || input.skillLevel < 1 || input.skillLevel > skill.maxLevel) throw Error('请选择有效的实际主技能等级')
  const skillValue = (skillModel.skillValues as Record<string, number[]>)[skill.id]?.[input.skillLevel - 1]
  if (skillValue == null) throw Error('该主技能等级暂无 SP 估值资料')
  const subs = unlockedSubskills(input.level, input.subskills)
  const speedCut = (subs.includes('helpS') ? speedRules.helpS : 0) + (subs.includes('helpM') ? speedRules.helpM : 0)
  const ribbon = ribbonBonus(input.ribbonHours, stagesLeft(poke.id))
  const frequency = poke.interval * trunc(((formula.levelNumerator - input.level) / formula.levelDenominator) * natureHelpFactor(input.nature) * (1 - ribbon.speedCut) * (1 - speedCut), formula.frequencyDigits)
    - (input.level === formula.frequencyCorrection.level && poke.interval === formula.frequencyCorrection.interval ? formula.frequencyCorrection.seconds : 0)
  const helps = formula.helpHours * trunc(3600 / frequency, formula.helpsDigits)
  const rate = (base: number, stat: 'ingredient' | 'skill', small: string, medium: string) => trunc(base
    * natureStatFactor(input.nature, stat)
    * (1 + (subs.includes(small) ? findingRules.findingS : 0) + (subs.includes(medium) ? findingRules.findingM : 0)), formula.rateDigits)
  const ingredientRate = rate(poke.ingredientRate, 'ingredient', 'ingS', 'ingM')
  const skillRate = rate(poke.skillRate, 'skill', 'skillS', 'skillM')
  let ingredientEnergy = 0, count = 0
  for (let slot = 0; slot < 3; slot++) {
    if (input.level < INGREDIENT_GATES[slot]!) continue
    const index = input.ingredientSlots[slot]
    if (index == null && poke.specialty === '全部' && slot > 0) continue
    const cell = index == null ? null : ingredientColumns(poke.ingredients)[slot]?.find(cell => cell.index === index)
    if (!cell || !slotDrop(poke.ingredients, slot, cell.index)) throw Error(`请选择有效的 Lv.${INGREDIENT_GATES[slot]} 食材`)
    const ingredient = ingredientById(cell.id)
    if (!ingredient) throw Error('缺少食材基础能量资料')
    ingredientEnergy += ingredient.energy * cell.amount
    count++
  }
  ingredientEnergy = Math.floor(ingredientEnergy / count)
  const bonusRules = skillModel.bonus
  const subBonus = subs.reduce((sum, id) => sum + ((bonusRules.inventory as Record<string, number>)[id] ?? 0)
    + (bonusRules.teamSubskills.includes(id) ? bonusRules.team : 0), 1)
  const bonus = trunc((nature.up === 'energy' ? bonusRules.energyUp : nature.down === 'energy' ? bonusRules.energyDown : 1) * subBonus, formula.bonusDigits)
  const berryRules = ruleParameters.modules.produce.berryPerHelp
  const berries = (poke.specialty === '树果型' || poke.specialty === '全部' ? berryRules.specialistBerries : berryRules.normalBerries)
    + (subs.includes('berryS') ? berryRules.berrySFruitBonus : 0)
  const berry = trunc(helps * (1 - ingredientRate) * berryEnergyAt(poke.berry, input.level) * berries, formula.componentDigits)
  const ingredient = trunc(helps * ingredientRate * ingredientEnergy * model.ingredientGrowth[input.level - 1]!, formula.componentDigits)
  const skillSp = trunc(helps * skillRate * skillValue, formula.componentDigits)
  // Upstream truncates each raw component first, then applies the common bonus.
  const scaled = (value: number, digits: number) => Number((value * 10 ** digits).toFixed(6))
  return { total: Math.round((scaled(berry, formula.componentDigits) + scaled(ingredient, formula.componentDigits) + scaled(skillSp, formula.componentDigits))
      * scaled(bonus, formula.bonusDigits) / 10 ** (formula.componentDigits + formula.bonusDigits)),
    berry: trunc(berry * bonus, formula.outputDigits), ingredient: trunc(ingredient * bonus, formula.outputDigits), skill: trunc(skillSp * bonus, formula.outputDigits),
    frequency, helps, ingredientRate, skillRate, bonus, skillLevel: input.skillLevel, skillValue,
    estimated: input.level > GAME_LEVEL_MAX }
}
