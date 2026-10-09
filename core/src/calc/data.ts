import berries from '../data/berries.json'
import candyDrops from '../data/candy-drops.json'
import encounterBands from '../data/encounter-bands.json'
import fallbacks from '../data/fallbacks.json'
import ingredients from '../data/ingredients.json'
import islands from '../data/islands.json'
import mealRecovery from '../data/meal-recovery.json'
import natures from '../data/natures.json'
import pokedex from '../data/pokedex.json'
import potTiers from '../data/pot-tiers.json'
import ranks from '../data/ranks.json'
import recipes from '../data/recipes.json'
import sleepStyles from '../data/sleep-styles.json'
import subskills from '../data/subskills.json'
import xp from '../data/xp.json'
import type { IslandId } from '../types'
import { foldText } from './text'

export const BERRIES = berries
export const INGREDIENTS = ingredients
export const RECIPES = recipes
export interface PokeRow {
  id: number
  name: string
  specialty: string
  sleepType: string
  berry: string
  berryType: string
  interval: number
  carry: number
  ingredientRate: number
  skillRate: number
  mainSkill: string
  friendship: number
  medalGroup: number | null
  ingredients: { id: number, name: string, amounts: number[] }[]
  formKey: string
}

export const POKEDEX = pokedex as PokeRow[]
export const ISLANDS = islands
export const ENCOUNTER_BANDS = encounterBands
export const FALLBACKS = fallbacks
export const XP_TABLE = xp
export const CANDY_DROPS = candyDrops
export const MEAL_RECOVERY = mealRecovery
export const POT_TIERS = potTiers
export const RANKS = ranks
export interface SleepStyleRow {
  id: number
  pokeId: number
  name: string
  island: string
  sleepType: string
  stars: number
  styleName: string
  dpr: number
  dprSource?: string
  dprSettled?: boolean
  /** User-approved EX2 fallback or an explicitly unverified legacy estimate. */
  dprEstimated?: boolean
  /** 同一星级有多条睡姿时的睡姿 id。百变怪四星、五星特殊睡姿用它拆开。 */
  styleId?: number
  /** 五星活动限定睡姿。每张地图都展示，不进入平时抽选。 */
  limited?: boolean
}

export const SLEEP_STYLES = sleepStyles as SleepStyleRow[]
export const NATURES = natures
export const SUBSKILLS = subskills

export function pokeById(id: number) {
  return POKEDEX.find((p) => p.id === id)
}

export function islandById(id: IslandId) {
  return ISLANDS.find((i) => i.id === id)
}

export function berryByName(name: string) {
  const folded = foldText(name)
  return BERRIES.find((b) => b.name === name || name.startsWith(b.name))
    ?? BERRIES.find((b) => folded.startsWith(foldText(b.name)))
}

export function natureByName(name: string) {
  return NATURES.find((n) => n.name === name) ?? NATURES[20]
}

export function ingredientById(id: number) {
  return INGREDIENTS.find((i) => i.id === id)
}

export function ingredientByName(name: string) {
  return INGREDIENTS.find((i) => i.name === name)
}
