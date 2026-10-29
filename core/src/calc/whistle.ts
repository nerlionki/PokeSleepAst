import runtimeParameters from '../data/runtime-parameters.resource'
import ruleCatalogs from '../data/rule-catalogs.resource'
import ruleParameters from '../data/rule-parameters.resource'
import extracted0 from '../data/client-defaults.resource'
import { cloneData } from './dataClone'
import type { BoxPokemon, Settings } from '../types'
import { berryByName, NATURES, pokeById } from './data'
import { berryUnitEnergy as unitEnergy } from './berry'
import { exEffects } from './exEffects'
import { activityBerrySettings, createActivityContext } from './activities'
import { energyMultiplier, levelInterval } from './helpSpeed'
import { berryCount, slotDrop } from './ingredients'
import { unlockedSubskills } from './member'
import { natureStatFactor } from './natureLabels'
import { normalizeOcrMissing } from './ocrCompletion'
import { ribbonBonus, stagesLeft } from './ribbon'
import { POKEMON_LEVEL_MAX } from './xp'
import { nextSpecialTeamState, type SpecialTeamState } from './teamRestrictions'
const whistle_config_extracted0 = extracted0.modules.whistle
const whistle_whistleMember_ruleParameters = ruleParameters.modules.whistle.whistleMember
const whistle_whistleMember_runtimeParameters = runtimeParameters.modules.whistle.whistleMember.values
const whistle_invalidMember_runtimeParameters = runtimeParameters.modules.whistle.invalidMember.values
const whistle_config_ruleCatalogs = ruleCatalogs.modules.whistle
const whistle_planWhistle_ruleParameters = ruleParameters.modules.whistle.planWhistle


export interface WhistleOptions {
  currentEnergy: number
  targetEnergy: number
}

export const DEFAULT_WHISTLE: WhistleOptions = (cloneData(whistle_config_extracted0.DEFAULT_WHISTLE) as unknown as WhistleOptions)

export function normalizeWhistleOptions(raw?: Partial<WhistleOptions>): WhistleOptions {
  const energy = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0
  return { currentEnergy: energy(raw?.currentEnergy), targetEnergy: energy(raw?.targetEnergy) }
}

export interface WhistleMember {
  pokemon: BoxPokemon
  helpingBonus: boolean
  interval: number
  helps: number
  ingredientRate: number
  berries: number
  berry: string
  berryUnitEnergy: number
  berryEnergy: number
  ingredients: Record<string, number>
}

export interface WhistleResult {
  members: WhistleMember[]
  helpingBonus: number
  berryEnergy: number
  ingredients: Record<string, number>
  gap: number
  whistles: number | null
  finalEnergy: number | null
  totalIngredients: Record<string, number>
  teamsCompared: number
  excluded: { uid: string, name: string, reason: string }[]
}

/** Whistle drops are rounded expectations, not random helps.
 * Original measurements: https://namakemono289.hatenablog.com/entry/2025/12/23/011054
 * EX berry multiplier and excluded speed/ingredient bonuses:
 * https://wikiwiki.jp/poke_sleep/どうぐ/おてつだいホイッスル
 */
export function whistleMember(settings: Settings, pokemon: BoxPokemon, helpingBonus: number): WhistleMember {
  settings = activityBerrySettings(settings, createActivityContext('research', settings.activity))
  const poke = pokeById(pokemon.pokeId)
  if (!poke) throw new Error('宝可梦资料不存在')
  const subs = unlockedSubskills(pokemon.level, pokemon.subskills)
  const ribbon = ribbonBonus(pokemon.tune?.ribbonHours ?? 0, stagesLeft(poke.id))
  // Use the displayed team interval, then maximum-energy efficiency. No camp or EX speed modifier.
  const interval = levelInterval(poke.interval, pokemon.level, pokemon.nature, subs, helpingBonus, ribbon.speedCut)
  const helps = whistle_whistleMember_ruleParameters.rewardSeconds / (interval * energyMultiplier((whistle_whistleMember_runtimeParameters.p001 as 100)))
  const unlocked = pokemon.level >= (whistle_whistleMember_runtimeParameters.p002 as 60) ? 3 : pokemon.level >= (whistle_whistleMember_runtimeParameters.p003 as 30) ? 2 : 1
  const slots = pokemon.ingredientSlots.slice(0, unlocked).flatMap((index, slot) => {
    if (index == null) return []
    const drop = slotDrop(poke.ingredients, slot, index)
    return drop ? [drop] : []
  })
  const ingredientRate = slots.length ? Math.min(1, poke.ingredientRate * natureStatFactor(pokemon.nature, 'ingredient')
    * (1 + (subs.includes('ingS') ? whistle_whistleMember_ruleParameters.findingS : 0) + (subs.includes('ingM') ? whistle_whistleMember_ruleParameters.findingM : 0))) : 0
  const berries = Math.round(helps * (1 - ingredientRate) * (berryCount(poke.specialty) + (subs.includes('berryS') ? ruleParameters.modules.whistle.berryCount.berryS : 0)))
  const ingredients: Record<string, number> = {}
  for (const slot of slots) {
    const quantity = Math.round(helps * ingredientRate / slots.length * slot.amount)
    ingredients[slot.name] = (ingredients[slot.name] ?? 0) + quantity
  }
  // Berry energy has a linear lower bound at low levels; round area bonus before the favorite multiplier.
  // https://wikiwiki.jp/poke_sleep/きのみ
  const berryUnitEnergy = unitEnergy(poke.berry, pokemon.level, settings.areaBonus, exEffects(settings, poke.berry, poke.specialty).berryMultiplier)
  return { pokemon, helpingBonus: subs.includes('helpingBonus'), interval, helps, ingredientRate, berries,
    berry: poke.berry, berryUnitEnergy, berryEnergy: Math.round(berries * berryUnitEnergy * (whistle_whistleMember_runtimeParameters.p004 as 5)) / (whistle_whistleMember_runtimeParameters.p005 as 5), ingredients }
}

function invalidMember(pokemon: BoxPokemon): string | null {
  const poke = pokeById(pokemon.pokeId)
  if (!poke || !berryByName(poke.berry) || poke.interval <= 0) return '缺少宝可梦生产资料'
  if (!Number.isInteger(pokemon.level) || pokemon.level < 1 || pokemon.level > POKEMON_LEVEL_MAX) return '等级无效'
  if (!NATURES.some(nature => nature.name === pokemon.nature)) return '性格无效'
  const unlocked = pokemon.level >= (whistle_invalidMember_runtimeParameters.p001 as 60) ? 3 : pokemon.level >= (whistle_invalidMember_runtimeParameters.p002 as 30) ? 2 : 1
  const missing = normalizeOcrMissing(pokemon.ocrMissing).some(field => field === 'level' || field === 'nature'
    || field.startsWith('subskill') && pokemon.level >= whistle_config_ruleCatalogs.invalidMemberList0.values[Number(field.at(-1))]!
    || field.startsWith('ingredient') && Number(field.at(-1)) < unlocked)
  if (missing) return '生产相关 OCR 字段尚未确认'
  for (let slot = 0; slot < unlocked; slot++) {
    const index = pokemon.ingredientSlots[slot]
    if (index == null && poke.specialty === '全部' && slot > 0) continue
    if (index == null || !Number.isInteger(index) || index < 0 || index >= poke.ingredients.length || !slotDrop(poke.ingredients, slot, index)) return '已解锁食材配置无效'
  }
  return null
}

function addIngredients(target: Record<string, number>, source: Record<string, number>) {
  for (const [name, quantity] of Object.entries(source)) target[name] = (target[name] ?? 0) + quantity
}

/** 固定帮手奖励人数后，收益独立可加；按人数、奖励人数和特殊宝可梦状态
 * 动态规划选择合法队伍，保留取整收益，无需穷举所有五人组合。 */
export function planWhistle(settings: Settings, box: BoxPokemon[], options: WhistleOptions): WhistleResult {
  if ([options.currentEnergy, options.targetEnergy].some(value => !Number.isSafeInteger(value) || value < 0)) {
    throw new Error('当前能量和目标能量必须为非负整数')
  }
  if (!Number.isFinite(settings.areaBonus) || settings.areaBonus < 0 || settings.areaBonus > whistle_planWhistle_ruleParameters.areaBonusCap) throw new Error('岛屿加成须在 0%–85% 之间')
  const excluded: WhistleResult['excluded'] = []
  const seen = new Set<string>()
  const candidates = box.filter(pokemon => {
    const reason = !pokemon.uid || seen.has(pokemon.uid) ? '个体标识为空或重复' : invalidMember(pokemon)
    seen.add(pokemon.uid)
    if (reason) excluded.push({ uid: pokemon.uid, name: pokemon.name || pokeById(pokemon.pokeId)?.name || String(pokemon.pokeId), reason })
    return !reason
  })
  const size = Math.min(whistle_planWhistle_ruleParameters.teamSize, candidates.length)
  const extraBonus = Math.min(whistle_planWhistle_ruleParameters.teamSize, Math.max(0, Math.floor(Number(settings.helpingBonus) || 0)))
  let best: WhistleMember[] = []
  let bestEnergy = -1
  let bestBonus = 0
  let teamsCompared = 0
  for (let holders = 0; holders <= size && size > 0; holders++) {
    const bonus = Math.min(whistle_planWhistle_ruleParameters.teamSize, holders + extraBonus)
    const ranked = candidates.map(pokemon => whistleMember(settings, pokemon, bonus))
      .sort((a, b) => b.berryEnergy - a.berryEnergy || a.pokemon.uid.localeCompare(b.pokemon.uid))
    interface Selection { team: WhistleMember[], energy: number, holders: number, special: SpecialTeamState }
    let states = new Map<string, Selection>([['0/0/none', { team: [], energy: 0, holders: 0, special: 'none' }]])
    for (const member of ranked) {
      const next = new Map(states)
      for (const state of states.values()) {
        const count = state.team.length + 1
        const h = state.holders + Number(member.helpingBonus)
        const special = nextSpecialTeamState(state.special, member.pokemon.pokeId)
        if (count > size || h > holders || special == null) continue
        const key = `${count}/${h}/${special}`
        const energy = state.energy + member.berryEnergy
        if (!next.has(key) || energy > next.get(key)!.energy) next.set(key, { team: [...state.team, member], energy, holders: h, special })
      }
      states = next
    }
    const feasible = [...states.values()].filter(state => state.holders === holders && state.team.length > 0)
      .sort((a, b) => b.energy - a.energy || b.team.length - a.team.length)
    if (!feasible.length) continue
    const choice = feasible[0]!
    teamsCompared++
    if (choice.energy > bestEnergy || choice.energy === bestEnergy && choice.team.length > best.length) {
      best = choice.team; bestEnergy = choice.energy; bestBonus = bonus
    }
  }
  best.sort((a, b) => b.berryEnergy - a.berryEnergy || a.pokemon.uid.localeCompare(b.pokemon.uid))
  const berryEnergy = Math.round(Math.max(0, bestEnergy) * whistle_planWhistle_ruleParameters.teamSize) / whistle_planWhistle_ruleParameters.teamSize
  const gap = Math.max(0, options.targetEnergy - options.currentEnergy)
  const whistles = gap === 0 ? 0 : berryEnergy > 0 ? Math.ceil((gap * whistle_planWhistle_ruleParameters.teamSize) / Math.round(berryEnergy * whistle_planWhistle_ruleParameters.teamSize)) : null
  const ingredients: Record<string, number> = {}
  for (const member of best) addIngredients(ingredients, member.ingredients)
  const totalIngredients = Object.fromEntries(Object.entries(ingredients).map(([name, quantity]) => [name, quantity * (whistles ?? 0)]))
  return { members: best, helpingBonus: bestBonus, berryEnergy, ingredients, gap, whistles,
    finalEnergy: whistles == null ? null : Math.round((options.currentEnergy + whistles * berryEnergy) * whistle_planWhistle_ruleParameters.teamSize) / whistle_planWhistle_ruleParameters.teamSize,
    totalIngredients, teamsCompared, excluded }
}
