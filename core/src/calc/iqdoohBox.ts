import runtimeParameters from '../data/runtime-parameters.resource'
import ruleCatalogs from '../data/rule-catalogs.resource'
import extracted0 from '../data/compatibility-maps.resource'
import { cloneData } from './dataClone'
import { newUid } from './uid'
import { NATURES, SUBSKILLS, pokeById } from './data'
import { ingredientColumns } from './ingredients'
import type { BoxPokemon, NatureStat, OcrMissingField } from '../types'
import { POKEMON_LEVEL_MAX } from './xp'
const iqdoohBox_config_extracted0 = extracted0.modules.iqdoohBox
const iqdoohBox_config_ruleCatalogs = ruleCatalogs.modules.iqdoohBox
const iqdoohBox_parseIqdoohEntry_runtimeParameters = runtimeParameters.modules.iqdoohBox.parseIqdoohEntry.values


const FORMS: Record<string, number> = (cloneData(iqdoohBox_config_extracted0.FORMS) as unknown as Record<string, number>)
const ATTRS: Record<string, NatureStat> = (cloneData(iqdoohBox_config_extracted0.ATTRS) as unknown as Record<string, NatureStat>)
const SKILLS: Record<string, string> = (cloneData(iqdoohBox_config_extracted0.SKILLS) as unknown as Record<string, string>)

export function parseIqdoohEntry(raw: Record<string, unknown>): BoxPokemon | null {
  const dex = String(raw.dex ?? '').match(/^#?(\d+)(?:-(\d+))?$/)
  if (!dex) return null
  const base = Number(dex[1])
  const pokeId = dex[2] ? FORMS[`${base}-${Number(dex[2])}`] : base
  const poke = pokeId ? pokeById(pokeId) : undefined
  if (!poke) return null
  const missing: OcrMissingField[] = [...iqdoohBox_config_ruleCatalogs.parseIqdoohEntryList0.values] as OcrMissingField[]
  const realLevel = Number(raw.levelReal ?? raw.level)
  const level = Number.isInteger(realLevel) && realLevel >= 1 && realLevel <= POKEMON_LEVEL_MAX ? realLevel : 1
  if (level !== realLevel) missing.push('level')
  const neutral = raw.incAttr == null && raw.decAttr == null
  const nature = neutral ? '勤奋' : NATURES.find(n =>
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
  return {
    uid: id ? `iqdooh-${id}` : `iqdooh-${newUid()}`, pokeId: poke.id, level,
    nature: nature ?? '勤奋', subskills, ingredientSlots, skillLevel: 1,
    name: String(raw.nickname ?? raw.name ?? ''), napping: false,
    ...(raw.shiny === true ? { shiny: true } : {}), ocrMissing: missing,
  }
}
