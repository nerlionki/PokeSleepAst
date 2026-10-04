import { BERRIES, INGREDIENTS, pokeById, SUBSKILLS } from './data'
import { MAIN_SKILLS } from './mainSkills'
import { SUBSKILL_GATES } from './member'
import { specialtyHit } from './specialty'
import { foldText, textHit } from './text'
import type { BoxPokemon } from '../types'

export type LockMode = 'unlocked' | 'locked'
export type Combine = 'and' | 'or'

export interface BoxQuery {
  text: string
  berryType: string
  specialty: string
  mainSkill: string
  ingredients: string[]
  ingredientLock: LockMode
  subskills: string[]
  subskillLock: LockMode
  subskillCombine: Combine
}

export const EMPTY_BOX_QUERY: BoxQuery = {
  text: '',
  berryType: '',
  specialty: '',
  mainSkill: '',
  ingredients: [],
  ingredientLock: 'unlocked',
  subskills: [],
  subskillLock: 'unlocked',
  subskillCombine: 'and',
}

export function speciesName(pokeId: number): string {
  return pokeById(pokeId)?.name ?? `#${pokeId}`
}

export function boxLabel(pokemon: { pokeId: number, name?: string }): string {
  const custom = pokemon.name?.trim()
  return custom || speciesName(pokemon.pokeId)
}

function slotOpen(level: number, slot: number): boolean {
  if (slot <= 0) return true
  if (slot === 1) return level >= 30
  return level >= 60
}

interface Tagged {
  id: string
  open: boolean
}

function ingredientName(name: string): string {
  const hit = INGREDIENTS.find((item) => foldText(item.name) === foldText(name))
  return hit?.name ?? name
}

function ingredientTags(pokemon: BoxPokemon): Tagged[] {
  const lines = pokeById(pokemon.pokeId)?.ingredients ?? []
  return pokemon.ingredientSlots.flatMap((index, slot) => {
    if (index == null) return []
    const line = lines[index]
    if (!line) return []
    return [{ id: ingredientName(line.name), open: slotOpen(pokemon.level, slot) }]
  })
}

function subskillTags(pokemon: BoxPokemon): Tagged[] {
  return pokemon.subskills.flatMap((id, index) => {
    if (!id) return []
    return [{ id, open: pokemon.level >= (SUBSKILL_GATES[index] ?? 1) }]
  })
}

function presence(have: Tagged[], id: string): 'missing' | 'open' | 'locked' {
  const rows = have.filter((item) => item.id === id)
  if (!rows.length) return 'missing'
  return rows.some((item) => item.open) ? 'open' : 'locked'
}

export function matchTagged(have: Tagged[], selected: readonly string[], mode: LockMode, how: Combine): boolean {
  if (!selected.length) return true
  const states = selected.map((id) => presence(have, id))
  if (how === 'or') return mode === 'unlocked' ? states.includes('open') : states.includes('locked')
  if (states.some((state) => state === 'missing')) return false
  if (mode === 'unlocked') return states.every((state) => state === 'open')
  return states.includes('locked')
}

function skillHit(mainSkill: string, selected: string): boolean {
  if (!selected) return true
  const skill = MAIN_SKILLS.find((item) => item.name === selected)
  const names = skill ? [skill.name, ...skill.aliases] : [selected]
  const folded = foldText(mainSkill)
  return names.some((name) => foldText(name) === folded)
}

export function boxMatches(pokemon: BoxPokemon, query: BoxQuery): boolean {
  const poke = pokeById(pokemon.pokeId)
  if (!poke) return false
  if (query.text && !textHit(boxLabel(pokemon), query.text)) return false
  if (query.berryType && poke.berryType !== query.berryType) return false
  if (!specialtyHit(poke.specialty, query.specialty)) return false
  if (!skillHit(poke.mainSkill, query.mainSkill)) return false
  if (!matchTagged(ingredientTags(pokemon), query.ingredients, query.ingredientLock, 'or')) return false
  if (!matchTagged(subskillTags(pokemon), query.subskills, query.subskillLock, query.subskillCombine)) return false
  return true
}

export interface FilterCatalog {
  berries: { name: string, type: string }[]
  skills: string[]
  ingredients: { id: number, name: string }[]
  subskills: { id: string, name: string }[]
}

export const FILTER_CATALOG: FilterCatalog = {
  berries: BERRIES.map((item) => ({ name: item.name, type: item.type })),
  skills: MAIN_SKILLS.map((item) => item.name),
  ingredients: INGREDIENTS.map((item) => ({ id: item.id, name: item.name })),
  subskills: SUBSKILLS.map((item) => ({ id: item.id, name: item.name })),
}

export function filterCount(query: BoxQuery): number {
  return [query.text.trim(), query.berryType, query.specialty, query.mainSkill, query.ingredients.length, query.subskills.length].filter(Boolean).length
}
