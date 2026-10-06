import mythical from '../data/mythical.json'
import { pokeById } from './data'

/** 图鉴资料里全能型（目前是梦幻、达克莱伊）的专长写作「全部」。 */
const ALL_ROUNDER = '全部'

export const SPECIALTY_FILTERS = ['树果型', '食材型', '技能型', '全能型'] as const

export function isAllRounder(poke: { specialty: string } | null | undefined): boolean {
  return poke?.specialty === ALL_ROUNDER
}

/** 技能型与全能型可储存两次主技能，其余专长只能储存一次。 */
export function skillStorageLimit(specialty: string): number {
  return specialty === '技能型' || specialty === ALL_ROUNDER ? 2 : 1
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
