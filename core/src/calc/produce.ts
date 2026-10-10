import { resolveMemberSkill } from './mew'
import { simulateTeam } from './timeline'
import type { ProduceInput, ProduceResult, Settings } from '../types'
import { exEffects } from './exEffects'
import { skillMaxFor, skillByPokedexName } from './mainSkills'
import { berryEnergyAt } from './berry'
import { pokeById } from './data'
import { instantInterval } from './helpSpeed'
import { slotDrop } from './ingredients'
import { effectiveSkillLevel, unlockedSubskills } from './member'
import { natureStatFactor } from './natureLabels'
import { ribbonBonus, stagesLeft } from './ribbon'
import { chargeStrength } from './skills'

const EMPTY: ProduceResult = { helps: 0, berries: 0, berryEnergy: 0, ingredients: {}, skillProcs: 0, skillEnergy: 0, sneaky: 0, curve: [] }

function berryPerHelp(specialty: string, subskills: string[]): number {
  let n = specialty === '树果型' || specialty === '全部' ? 2 : 1
  if (subskills.includes('berryS')) n += 1
  return n
}

function findingRate(base: number, nature: string, stat: 'ingredient' | 'skill', subskills: string[], small: string, medium: string): number {
  const bonus = 1 + (subskills.includes(small) ? 0.18 : 0) + (subskills.includes(medium) ? 0.36 : 0)
  return Math.min(1, base * natureStatFactor(nature, stat) * bonus)
}

function cutDecimal(value: number, places: number): number {
  const scale = 10 ** places
  return Math.floor(value * scale) / scale
}

/**
 * 一次帮忙只出一种：树果，或已解锁的某一槽食材。技能不占用这次帮忙。
 * 食材次数、技能次数按期望计算；有概率但不足 1 次时保底 1 次。
 */
export function splitHelps(
  helps: number,
  ingRate: number,
  skillRate: number,
  slots: { name: string, amount: number }[],
  snacking: boolean,
): { berryHelps: number, ingredients: Record<string, number>, skillProcs: number } {
  let skillProcs = cutDecimal(helps * skillRate, 1)
  if (!snacking && skillRate > 0 && skillProcs < 1) skillProcs = 1
  if (snacking) skillProcs = 0
  let foodHelps = slots.length ? cutDecimal(helps * ingRate, 2) : 0
  if (!snacking && ingRate > 0 && slots.length && foodHelps < 1) foodHelps = 1
  if (snacking) foodHelps = 0
  const berryHelps = Math.max(0, cutDecimal(helps - foodHelps, 2))
  const ingredients: Record<string, number> = {}
  if (foodHelps > 0 && slots.length) {
    for (const slot of slots) {
      let count = cutDecimal(foodHelps / slots.length * slot.amount, 1)
      if (count >= 100) count = Math.floor(count)
      ingredients[slot.name] = (ingredients[slot.name] ?? 0) + count
    }
  }
  return { berryHelps, ingredients, skillProcs }
}

/**
 * 个体对比用的日产量。按全天维持传入活力（对比页传满活力）的固定间隔取期望值。
 * 产量拆法对齐 pokeSleepCalc 的 getOneDayHelpCount / getOneDayEnergy。
 */
export function produce(settings: Settings, input: ProduceInput, helpingBonus = settings.helpingBonus): ProduceResult {
  const species = pokeById(input.pokeId)
  const selected = species ? resolveMemberSkill(species, input) : null
  const poke = species && selected ? { ...species, mainSkill: selected.name, skillRate: selected.rate } : undefined
  if (!poke) return { ...EMPTY }
  if (input.pokeId === 151 || skillByPokedexName(poke.mainSkill)?.id === 12) {
    const sim = simulateTeam(settings, [input], helpingBonus, { excludeSkillFoodFromCooking: true, fixedEnergy: input.wakeEnergy ?? 100 })
    const result = sim.members[0]!
    const ingredients = Object.fromEntries(Object.entries(result.ingredients).map(([name, count]) => [name, Math.max(0, count - (result.skillIngredients?.[name] ?? 0))] as const).filter(([, count]) => count > 1e-8))
    return { ...result, ingredients, cooking: { energy: sim.meals.reduce((sum, meal) => sum + meal.energy, 0), remain: sim.remain } }
  }
  const subs = unlockedSubskills(input.level, input.subskills)
  const ribbon = ribbonBonus(input.ribbonHours ?? 0, stagesLeft(poke.id))
  const energy = Math.min(150, Math.max(0, input.wakeEnergy ?? settings.sleepScore))
  const favored = settings.berries.includes(poke.berry)
  const ex = exEffects(settings, poke.berry, poke.specialty)
  const seconds = instantInterval(
    poke.interval,
    input.level,
    input.nature,
    subs,
    helpingBonus,
    energy,
    settings.goodCamp,
    settings.island,
    favored,
    ribbon.speedCut,
    ex.speed,
  )
  const days = settings.period === 'week' ? 7 : 1
  const helps = seconds > 0 ? (86400 * days) / seconds : 0
  const ingRate = findingRate(poke.ingredientRate, input.nature, 'ingredient', subs, 'ingS', 'ingM')
  const skillRate = Math.min(1, findingRate(poke.skillRate, input.nature, 'skill', subs, 'skillS', 'skillM') * ex.skillMultiplier)
  const per = berryPerHelp(poke.specialty, subs)
  const snacking = input.carryMode === 'full'
  const unlocked = input.level >= 60 ? 3 : input.level >= 30 ? 2 : 1
  const slots = input.ingredientSlots.slice(0, unlocked).flatMap((lineIndex, slot) => {
    if (lineIndex == null) return []
    const drop = slotDrop(poke.ingredients, slot, lineIndex)
    return drop ? [{ name: drop.name, amount: drop.amount + ex.ingredientExtra }] : []
  })
  const split = splitHelps(helps, ingRate, skillRate, slots, snacking)
  const berries = cutDecimal(split.berryHelps * per, 1)
  const unit = berryEnergyAt(poke.berry, input.level) * ex.berryMultiplier * (1 + settings.areaBonus)
  const skillLv = Math.min(skillMaxFor(poke.mainSkill), effectiveSkillLevel(input.level, input.skillLevel, input.subskills, poke.mainSkill) + ex.skillLevels)
  return {
    helps,
    berries,
    berryEnergy: Math.floor(berries * unit),
    ingredients: split.ingredients,
    skillProcs: split.skillProcs,
    skillEnergy: Math.floor(split.skillProcs * chargeStrength(poke.mainSkill, skillLv) * (1 + settings.areaBonus)),
    sneaky: snacking ? helps : 0,
    curve: [],
  }
}
