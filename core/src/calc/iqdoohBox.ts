import runtimeParameters from '../data/runtime-parameters.resource'
import extracted0 from '../data/compatibility-maps.resource'
import { cloneData } from './dataClone'
import { newUid } from './uid'
import { NEUTRAL_NATURE, NATURES, SUBSKILLS, pokeById } from './data'
import { ingredientColumns } from './ingredients'
import { defaultSkillLevel, defaultTune, parseImportedSkillLevel } from './member'
import { skillMaxFor } from './mainSkills'
import { resolveMemberSkill } from './mew'
import type { BoxPokemon, NatureStat, OcrMissingField } from '../types'
import { POKEMON_LEVEL_MAX } from './xp'
const iqdoohBox_config_extracted0 = extracted0.modules.iqdoohBox
const iqdoohBox_parseIqdoohEntry_runtimeParameters = runtimeParameters.modules.iqdoohBox.parseIqdoohEntry.values


const FORMS: Record<string, number> = (cloneData(iqdoohBox_config_extracted0.FORMS) as unknown as Record<string, number>)
const ATTRS: Record<string, NatureStat> = (cloneData(iqdoohBox_config_extracted0.ATTRS) as unknown as Record<string, NatureStat>)
const SKILLS: Record<string, string> = (cloneData(iqdoohBox_config_extracted0.SKILLS) as unknown as Record<string, string>)

function parseLevel(value: unknown): number | undefined {
  if (typeof value !== 'number' && typeof value !== 'string') return undefined
  const level = Number(value)
  if (Number.isInteger(level) && level >= 1 && level <= POKEMON_LEVEL_MAX) return level
}

export function parseIqdoohEntry(raw: Record<string, unknown>, defaultMaxSkillLevel = true): BoxPokemon | null {
  const dex = String(raw.dex ?? '').match(/^#?(\d+)(?:-(\d+))?$/)
  if (!dex) return null
  const base = Number(dex[1])
  const pokeId = dex[2] ? FORMS[`${base}-${Number(dex[2])}`] : base
  const poke = pokeId ? pokeById(pokeId) : undefined
  if (!poke) return null
  const missing: OcrMissingField[] = []
  const level = parseLevel(raw.levelReal) ?? parseLevel(raw.level)
  if (level === undefined) missing.push('level')
  const neutral = raw.incAttr == null && raw.decAttr == null
  const nature = neutral ? NEUTRAL_NATURE : NATURES.find(n =>
    n.up === ATTRS[String(raw.incAttr)] && n.down === ATTRS[String(raw.decAttr)] && n.up !== undefined)?.name
  if (!nature) missing.push('nature')
  const selected = Array.isArray(raw.selected) ? raw.selected : []
  const subskills = Array.from({ length: (iqdoohBox_parseIqdoohEntry_runtimeParameters.p001 as 5) }, (_, i) => {
    const skill = SKILLS[String(selected[i])]
    if (!skill || !SUBSKILLS.some(s => s.id === skill)) missing.push(`subskill${i}` as OcrMissingField)
    return skill ?? ''
  })
  const columns = ingredientColumns(poke.ingredients)
  const choices = ['a', raw.ingChoice2, raw.ingChoice3]
  const ingredientSlots = choices.map((choice, i) => {
    const cell = columns[i]?.find(c => c.letter.toLowerCase() === choice)
    if (!cell) missing.push(`ingredient${i}` as OcrMissingField)
    return cell?.index ?? null
  }) as BoxPokemon['ingredientSlots']
  const id = raw.id == null ? '' : String(raw.id)
  const satiety = raw.satiety
  const ribbonHours = typeof satiety === 'number' || (typeof satiety === 'string' && satiety.trim()) ? Number(satiety) : NaN
  const skillLevel = parseImportedSkillLevel(raw.skillLevel ?? raw.skilllevel ?? raw.mainSkillLevel)
    ?? (defaultMaxSkillLevel ? skillMaxFor(resolveMemberSkill(poke, {}).name) : defaultSkillLevel(poke.id))
  return {
    uid: id ? `iqdooh-${id}` : `iqdooh-${newUid()}`, pokeId: poke.id, level: level ?? 1,
    nature: nature ?? NEUTRAL_NATURE, subskills, ingredientSlots, skillLevel,
    name: String(raw.nickname ?? raw.name ?? ''), napping: false,
    ...(Number.isFinite(ribbonHours) && ribbonHours >= 0 ? { tune: { ...defaultTune(), ribbonHours } } : {}),
    ...(raw.shiny === true ? { shiny: true } : {}), ocrMissing: missing,
  }
}
