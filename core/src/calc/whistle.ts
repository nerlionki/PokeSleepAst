import type { BoxPokemon, Settings } from '../types'
import { berryByName, NATURES, pokeById } from './data'
import { exEffects } from './exEffects'
import { energyMultiplier, levelInterval } from './helpSpeed'
import { berryCount, slotDrop } from './ingredients'
import { unlockedSubskills } from './member'
import { natureStatFactor } from './natureLabels'
import { normalizeOcrMissing } from './ocrCompletion'
import { ribbonBonus, stagesLeft } from './ribbon'
import { POKEMON_LEVEL_MAX } from './xp'

export interface WhistleOptions {
  currentEnergy: number
  targetEnergy: number
}

export const DEFAULT_WHISTLE: WhistleOptions = { currentEnergy: 0, targetEnergy: 0 }

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
  const poke = pokeById(pokemon.pokeId)
  if (!poke) throw new Error('宝可梦资料不存在')
  const subs = unlockedSubskills(pokemon.level, pokemon.subskills)
  const ribbon = ribbonBonus(pokemon.tune?.ribbonHours ?? 0, stagesLeft(poke.id))
  // Use the displayed team interval, then maximum-energy efficiency. No camp or EX speed modifier.
  const interval = Math.max(1, Math.floor(levelInterval(poke.interval, pokemon.level, pokemon.nature, subs, helpingBonus) * (1 - ribbon.speedCut)))
  const helps = 10800 / (interval * energyMultiplier(100))
  const unlocked = pokemon.level >= 60 ? 3 : pokemon.level >= 30 ? 2 : 1
  const slots = pokemon.ingredientSlots.slice(0, unlocked).flatMap((index, slot) => {
    if (index == null) return []
    const drop = slotDrop(poke.ingredients, slot, index)
    return drop ? [drop] : []
  })
  const ingredientRate = slots.length ? Math.min(1, poke.ingredientRate * natureStatFactor(pokemon.nature, 'ingredient')
    * (1 + (subs.includes('ingS') ? 0.18 : 0) + (subs.includes('ingM') ? 0.36 : 0))) : 0
  const berries = Math.round(helps * (1 - ingredientRate) * (berryCount(poke.specialty) + (subs.includes('berryS') ? 1 : 0)))
  const ingredients: Record<string, number> = {}
  for (const slot of slots) {
    const quantity = Math.round(helps * ingredientRate / slots.length * slot.amount)
    ingredients[slot.name] = (ingredients[slot.name] ?? 0) + quantity
  }
  // Berry energy has a linear lower bound at low levels; round area bonus before the favorite multiplier.
  // https://wikiwiki.jp/poke_sleep/きのみ
  const base = berryByName(poke.berry)?.energyLv1 ?? 30
  const berryEnergy = Math.round(Math.max(base + pokemon.level - 1, base * 1.025 ** (pokemon.level - 1)))
  const berryUnitEnergy = Math.ceil(berryEnergy * (1 + settings.areaBonus)) * exEffects(settings, poke.berry, poke.specialty).berryMultiplier
  return { pokemon, helpingBonus: subs.includes('helpingBonus'), interval, helps, ingredientRate, berries,
    berry: poke.berry, berryUnitEnergy, berryEnergy: Math.round(berries * berryUnitEnergy * 5) / 5, ingredients }
}

function invalidMember(pokemon: BoxPokemon): string | null {
  const poke = pokeById(pokemon.pokeId)
  if (!poke || !berryByName(poke.berry) || poke.interval <= 0) return '缺少宝可梦生产资料'
  if (!Number.isInteger(pokemon.level) || pokemon.level < 1 || pokemon.level > POKEMON_LEVEL_MAX) return '等级无效'
  if (!NATURES.some(nature => nature.name === pokemon.nature)) return '性格无效'
  const unlocked = pokemon.level >= 60 ? 3 : pokemon.level >= 30 ? 2 : 1
  const missing = normalizeOcrMissing(pokemon.ocrMissing).some(field => field === 'level' || field === 'nature'
    || field.startsWith('subskill') && pokemon.level >= [10, 25, 50, 70, 80][Number(field.at(-1))]!
    || field.startsWith('ingredient') && Number(field.at(-1)) < unlocked)
  if (missing) return '生产相关 OCR 字段尚未确认'
  for (let slot = 0; slot < unlocked; slot++) {
    const index = pokemon.ingredientSlots[slot]
    if (index == null && poke.specialty === '全部') continue
    if (index == null || !Number.isInteger(index) || index < 0 || index >= poke.ingredients.length || !slotDrop(poke.ingredients, slot, index)) return '已解锁食材配置无效'
  }
  return null
}

function addIngredients(target: Record<string, number>, source: Record<string, number>) {
  for (const [name, quantity] of Object.entries(source)) target[name] = (target[name] ?? 0) + quantity
}

/** With a fixed number of Helping Bonus holders, scores are independent and additive.
 * Selecting the best h holders and best (size-h) non-holders in each h group finds the best team,
 * including integer drop rounding, without enumerating every 5-member combination.
 */
export function planWhistle(settings: Settings, box: BoxPokemon[], options: WhistleOptions): WhistleResult {
  if ([options.currentEnergy, options.targetEnergy].some(value => !Number.isSafeInteger(value) || value < 0)) {
    throw new Error('当前能量和目标能量必须为非负整数')
  }
  if (!Number.isFinite(settings.areaBonus) || settings.areaBonus < 0 || settings.areaBonus > 0.85) throw new Error('岛屿加成须在 0%–85% 之间')
  const excluded: WhistleResult['excluded'] = []
  const seen = new Set<string>()
  const candidates = box.filter(pokemon => {
    const reason = !pokemon.uid || seen.has(pokemon.uid) ? '个体标识为空或重复' : invalidMember(pokemon)
    seen.add(pokemon.uid)
    if (reason) excluded.push({ uid: pokemon.uid, name: pokemon.name || pokeById(pokemon.pokeId)?.name || String(pokemon.pokeId), reason })
    return !reason
  })
  const size = Math.min(5, candidates.length)
  const extraBonus = Math.min(5, Math.max(0, Math.floor(Number(settings.helpingBonus) || 0)))
  let best: WhistleMember[] = []
  let bestEnergy = -1
  let bestBonus = 0
  let teamsCompared = 0
  for (let holders = 0; holders <= size && size > 0; holders++) {
    const bonus = Math.min(5, holders + extraBonus)
    const ranked = candidates.map(pokemon => whistleMember(settings, pokemon, bonus))
      .sort((a, b) => b.berryEnergy - a.berryEnergy || a.pokemon.uid.localeCompare(b.pokemon.uid))
    const withBonus = ranked.filter(member => member.helpingBonus)
    const withoutBonus = ranked.filter(member => !member.helpingBonus)
    if (withBonus.length < holders || withoutBonus.length < size - holders) continue
    const team = [...withBonus.slice(0, holders), ...withoutBonus.slice(0, size - holders)]
    const energy = team.reduce((sum, member) => sum + member.berryEnergy, 0)
    teamsCompared++
    if (energy > bestEnergy) { best = team; bestEnergy = energy; bestBonus = bonus }
  }
  best.sort((a, b) => b.berryEnergy - a.berryEnergy || a.pokemon.uid.localeCompare(b.pokemon.uid))
  const berryEnergy = Math.round(Math.max(0, bestEnergy) * 5) / 5
  const gap = Math.max(0, options.targetEnergy - options.currentEnergy)
  const whistles = gap === 0 ? 0 : berryEnergy > 0 ? Math.ceil((gap * 5) / Math.round(berryEnergy * 5)) : null
  const ingredients: Record<string, number> = {}
  for (const member of best) addIngredients(ingredients, member.ingredients)
  const totalIngredients = Object.fromEntries(Object.entries(ingredients).map(([name, quantity]) => [name, quantity * (whistles ?? 0)]))
  return { members: best, helpingBonus: bestBonus, berryEnergy, ingredients, gap, whistles,
    finalEnergy: whistles == null ? null : Math.round((options.currentEnergy + whistles * berryEnergy) * 5) / 5,
    totalIngredients, teamsCompared, excluded }
}
