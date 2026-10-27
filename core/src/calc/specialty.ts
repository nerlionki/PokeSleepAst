import ruleParameters from '../data/rule-parameters.json'
import extracted0 from '../data/client-defaults.json'
import extracted1 from '../data/calc-tables.json'
import { cloneData } from './dataClone'
import mythical from '../data/mythical.json'
import { pokeById } from './data'
const specialty_config_extracted0 = extracted0.modules.specialty
const specialty_config_extracted1 = extracted1.modules.specialty
const specialty_skillStorageLimit_ruleParameters = ruleParameters.modules.specialty.skillStorageLimit


/** 图鉴资料里全能型（目前是梦幻、达克莱伊）的专长写作「全部」。 */
const ALL_ROUNDER = (specialty_config_extracted0.ALL_ROUNDER as "全部")

/**
 * Wiki 验证规则：进入满包后的前 4 次自然帮忙仍抽选主技能，第 5 次起停止。
 * 不包含使背包刚好装满的那次；额外帮忙不抽选，也不消耗这个窗口。
 * 这是社区验证口径，不是官方公布数值；核对日期：2026-10-23。
 * https://wikiwiki.jp/poke_sleep/メインスキル
 * https://wikiwiki.jp/poke_sleep/検証/メインスキルのクールタイム
 */
export const FULL_INVENTORY_SKILL_HELPS = (specialty_config_extracted1.FULL_INVENTORY_SKILL_HELPS as 4)

export const SPECIALTY_FILTERS = (cloneData(specialty_config_extracted1.SPECIALTY_FILTERS) as unknown as readonly ["树果型","食材型","技能型","全能型"])

export function isAllRounder(poke: { specialty: string } | null | undefined): boolean {
  return poke?.specialty === ALL_ROUNDER
}

/** 技能型与全能型可储存两次主技能，其余专长只能储存一次。 */
export function skillStorageLimit(specialty: string): number {
  return specialty === '技能型' || specialty === ALL_ROUNDER ? specialty_skillStorageLimit_ruleParameters.dualStorageCapacity : ruleParameters.modules.specialty.skillStorageLimit.normalCapacity
}

export function isAllRounderId(pokeId: number): boolean {
  return isAllRounder(pokeById(pokeId))
}

export function specialtyLabel(specialty: string): string {
  return specialty === ALL_ROUNDER ? '全能型' : specialty
}

/** 全能型算进每一种专长；只选全能型时只留全能型。 */
export function specialtyHit(specialty: string, selected: string): boolean {
  if (!selected || selected === '全部') return true
  if (selected === '全能型') return specialty === ALL_ROUNDER
  return specialty === selected || specialty === ALL_ROUNDER
}

interface MythicalInfo {
  seed: string
  seedItemId: number
  firstIngredient: string
  appear?: string
}

const MYTHICAL = mythical as Record<string, MythicalInfo>

/** RAE 图鉴 mythicalSeedItemId：捕捉后获得的灵感种子。 */
export function mythicalSeed(pokeId: number): string | null {
  return MYTHICAL[pokeId]?.seed ?? null
}

/** 不在地图上、只在特定活动出现的说明。 */
export function mythicalAppear(pokeId: number): string | null {
  return MYTHICAL[pokeId]?.appear ?? null
}

/** 全能型 OCR 读不到食材时，第 1 格默认填的食材在该宝可梦食材表里的下标。 */
export function defaultFirstSlot(pokeId: number): number {
  const name = MYTHICAL[pokeId]?.firstIngredient
  const index = name ? (pokeById(pokeId)?.ingredients.findIndex((item) => item.name === name) ?? -1) : -1
  return index < 0 ? 0 : index
}
