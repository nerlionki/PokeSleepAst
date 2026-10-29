import runtimeParameters from '../data/runtime-parameters.resource'
import ruleCatalogs from '../data/rule-catalogs.resource'
import extracted0 from '../data/compatibility-maps.resource'
import { cloneData } from './dataClone'
import { normalizeMewSkill } from './mew'
import type { BoxPokemon } from '../types'
import { INGREDIENTS, NATURES, POKEDEX, SUBSKILLS, pokeById } from './data'
import { foldText } from './text'
import { normalizeOcrMissing } from './ocrCompletion'
import { parseIqdoohEntry } from './iqdoohBox'
const boxio_config_extracted0 = extracted0.modules.boxio
const boxio_config_ruleCatalogs = ruleCatalogs.modules.boxio
const boxio_fromAny_runtimeParameters = runtimeParameters.modules.boxio.fromAny.values


export type BoxSource = 'native' | 'sdrice' | 'rae' | 'iqdooh' | 'mixed'

const NATURE_EN: Record<string, string> = (cloneData(boxio_config_extracted0.NATURE_EN) as unknown as Record<string, string>)

const NATURE_ID: Record<number, string> = (cloneData(boxio_config_extracted0.NATURE_ID) as unknown as Record<number, string>)

const SUB_ALIAS: Record<string, string> = (cloneData(boxio_config_extracted0.SUB_ALIAS) as unknown as Record<string, string>)

const ING_ALIAS: Record<string, number> = (cloneData(boxio_config_extracted0.ING_ALIAS) as unknown as Record<string, number>)

const EN_NAME: Record<number, string> = (cloneData(boxio_config_extracted0.EN_NAME) as unknown as Record<number, string>)

function keyOf(s: unknown): string {
  return foldText(String(s ?? ''))
}

function natureOf(raw: unknown): string {
  if (raw == null || raw === '') return '勤奋'
  if (typeof raw === 'number' && NATURE_ID[raw]) return NATURE_ID[raw]
  const k = keyOf(raw)
  if (NATURE_EN[k]) return NATURE_EN[k]
  const hit = NATURES.find((n) => keyOf(n.name) === k)
  if (hit) return hit.name
  if (k.includes('hup')) return '固执'
  if (k.includes('hdown')) return '大胆'
  return '勤奋'
}

function subOf(raw: unknown): string {
  if (raw == null || raw === '') return ''
  if (typeof raw === 'object') {
    const o = raw as Record<string, unknown>
    return subOf(o.id ?? o.name ?? o.subSkill ?? o.label)
  }
  const k = keyOf(raw)
  if (SUB_ALIAS[k]) return SUB_ALIAS[k]
  const byId = SUBSKILLS.find((s) => keyOf(s.id) === k || keyOf(s.name) === k)
  return byId?.id ?? ''
}

function subsOf(raw: unknown): string[] {
  if (!raw) return boxio_config_ruleCatalogs.subsOfList0.values
  if (Array.isArray(raw)) {
    const mapped = raw.map(subOf).filter(Boolean)
    return [mapped[0] ?? '', mapped[1] ?? '', mapped[2] ?? '', mapped[3] ?? '', mapped[4] ?? '']
  }
  if (typeof raw === 'object') {
    const o = raw as Record<string, unknown>
    const ordered = boxio_config_ruleCatalogs.subsOfList1.values
      .map((k) => o[k]).filter((v) => v != null)
    if (ordered.length) return subsOf(ordered)
    return subsOf(Object.values(o))
  }
  return subsOf(String(raw).split(/[|,，]/))
}

function pokeIdOf(raw: unknown): number {
  if (raw == null) return 0
  if (typeof raw === 'number' && pokeById(raw)) return raw
  const text = String(raw)
  const n = Number(text.replace(/^[^\d-]+/, ''))
  if (Number.isFinite(n) && pokeById(n)) return n
  const k = keyOf(text)
  const byName = POKEDEX.find((p) => keyOf(p.name) === k || keyOf(p.formKey) === k)
  if (byName) return byName.id
  const byEn = Object.entries(EN_NAME).find(([, en]) => en === k || k.includes(en) || en.includes(k))
  if (byEn && pokeById(Number(byEn[0]))) return Number(byEn[0])
  return 0
}

function ingIdOf(raw: unknown): number | null {
  if (raw == null) return null
  if (typeof raw === 'number') {
    if (INGREDIENTS.some((i) => i.id === raw)) return raw
    return raw
  }
  const k = keyOf(raw)
  if (ING_ALIAS[k]) return ING_ALIAS[k]
  const hit = INGREDIENTS.find((i) => keyOf(i.name) === k)
  return hit?.id ?? null
}

function slotsOf(pokeId: number, raw: unknown): [number, number, number] {
  const poke = pokeById(pokeId)
  const fallback: [number, number, number] = [0, 0, 0]
  if (!poke) return fallback
  if (typeof raw === 'string' && /^[ABC]{1,3}$/i.test(raw)) {
    return [0, 1, 2].map((i) => {
      const ch = raw[i]?.toUpperCase()
      return ch === 'B' ? 1 : ch === 'C' ? 2 : 0
    }) as [number, number, number]
  }
  const list = Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? Object.values(raw as object) : []
  const slots: [number, number, number] = [0, 0, 0]
  for (let i = 0; i < 3; i++) {
    const v = list[i]
    if (v == null) continue
    if (typeof v === 'number' && v >= 0 && v <= 2 && !poke.ingredients.some((ing) => ing.id === v)) {
      slots[i] = v
      continue
    }
    const id = ingIdOf(v)
    const idx = poke.ingredients.findIndex((ing) => ing.id === id)
    if (idx >= 0) slots[i] = idx
  }
  return slots
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : null
}

function extractList(raw: unknown): { list: unknown[], source: BoxSource } {
  if (Array.isArray(raw)) {
    if (raw.some(item => asRecord(item)?.dex != null)) return { list: raw, source: 'iqdooh' }
    if (raw.length && asRecord(raw[0])?.pokemonId != null) return { list: raw, source: 'sdrice' }
    if (raw.length && (asRecord(raw[0])?.pokemon != null || asRecord(raw[0])?.pokeId != null)) return { list: raw, source: 'rae' }
    return { list: raw, source: 'mixed' }
  }
  const o = asRecord(raw)
  if (!o) return { list: [], source: 'mixed' }
  if (o.version === 1 && Array.isArray(o.entries)) return { list: o.entries, source: 'iqdooh' }
  if (Array.isArray(o.pokemon) && o.schemaVersion) return { list: o.pokemon, source: 'native' }
  const rae = o.pokebox ?? o.PokeBox ?? o.pokeBox ?? asRecord(o.data)?.pokebox ?? o.pokemons
  if (Array.isArray(rae)) return { list: rae, source: 'rae' }
  if (Array.isArray(o.list) && o.list[0] && asRecord(o.list[0])?.pokemonId != null) return { list: o.list, source: 'sdrice' }
  if (Array.isArray(o.list)) return { list: o.list, source: 'mixed' }
  return { list: [], source: 'mixed' }
}

function nativeSlots(raw: unknown): BoxPokemon['ingredientSlots'] {
  if (!Array.isArray(raw)) return [0, 0, 0]
  const at = (index: number): number | null => {
    if (index >= raw.length) return 0
    if (raw[index] === null) return null
    const value = Number(raw[index])
    return Number.isInteger(value) && value >= 0 ? value : 0
  }
  return [at(0), at(1), at(2)]
}

function fromAny(item: unknown, source: BoxSource): BoxPokemon | null {
  const o = asRecord(item)
  if (!o) return null
  if (source === 'iqdooh') return parseIqdoohEntry(o)
  if (typeof o.pokeId === 'number' && o.uid) {
    return {
      uid: String(o.uid),
      pokeId: o.pokeId,
      level: Number(o.level) || 1,
      nature: natureOf(o.nature),
      subskills: Array.isArray(o.subskills) ? o.subskills.map(String) : boxio_config_ruleCatalogs.fromAnyList0.values,
      ingredientSlots: nativeSlots(o.ingredientSlots),
      skillLevel: Number(o.skillLevel) || 1,
      ...(o.pokeId === 151 ? { mewSkill: normalizeMewSkill(o.mewSkill) } : {}),
      name: String(o.name ?? o.note ?? ''),
      napping: Boolean(o.napping),
      ...(normalizeOcrMissing(o.ocrMissing).length ? { ocrMissing: normalizeOcrMissing(o.ocrMissing) } : {}),
      ...(o.shiny ? { shiny: true } : {}),
      tune: o.tune && typeof o.tune === 'object' ? o.tune as BoxPokemon['tune'] : undefined,
    }
  }
  const pokeId = pokeIdOf(o.pokemonId ?? o.pokemon ?? o.pokeId ?? o.pid ?? o.id)
  if (!pokeId) return null
  const uid = String(o.uid ?? o.uuid ?? o.dataId ?? `imp-${source}-${pokeId}-${o.level ?? 1}-${Math.random().toString((boxio_fromAny_runtimeParameters.p001 as 16)).slice(2, (boxio_fromAny_runtimeParameters.p002 as 8))}`)
  return {
    uid,
    pokeId,
    level: Number(o.level ?? o.lv ?? 1) || 1,
    nature: natureOf(o.nature ?? o.character ?? o.natureId),
    subskills: subsOf(o.subskills ?? o.subSkill ?? o.subSkills ?? o.skill),
    ingredientSlots: slotsOf(pokeId, o.ingredientSlots ?? o.ingredients ?? o.useFoods ?? o.ingredient),
    skillLevel: Number(o.skillLevel ?? o.skilllevel ?? o.mainSkillLevel ?? 1) || 1,
    name: String(o.nickname ?? o.note ?? o.name ?? ''),
    napping: Boolean(o.napping),
  }
}

export function parseBoxImport(raw: unknown): { source: BoxSource, pokemon: BoxPokemon[], skipped: number } {
  const { list, source } = extractList(raw)
  const pokemon: BoxPokemon[] = []
  let skipped = 0
  for (const item of list) {
    const row = fromAny(item, source)
    if (row) pokemon.push(row)
    else skipped += 1
  }
  return { source, pokemon, skipped }
}

export function parseBoxText(text: string) {
  const trimmed = text.trim()
  if (!trimmed) return { source: 'mixed' as BoxSource, pokemon: [], skipped: 0 }
  return parseBoxImport(JSON.parse(trimmed))
}

export function exportNative(pokemon: BoxPokemon[]) {
  return { schemaVersion: 1 as const, pokemon }
}

export function exportSdrice(pokemon: BoxPokemon[]) {
  return pokemon.map((p) => ({
    dataId: p.uid,
    pokemonId: p.pokeId,
    isShiny: false,
    evotimes: 0,
    skilllevel: p.skillLevel,
    level: p.level,
    skill: p.subskills.filter(Boolean),
    character: p.nature,
    useFoods: p.ingredientSlots.map((slot) => slot ?? 0),
    nickname: p.name,
  }))
}
