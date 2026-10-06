import { newUid } from './uid'
import { NATURES, SUBSKILLS, pokeById } from './data'
import { ingredientColumns } from './ingredients'
import type { BoxPokemon, NatureStat, OcrMissingField } from '../types'
import { POKEMON_LEVEL_MAX } from './xp'

const FORMS: Record<string, number> = {
  '25-1': 9001, '25-2': 9002, '25-3': 9007,
  '37-1': 7006, '38-1': 7007, '194-1': 7054,
  '133-1': 9004, '133-2': 9005, '363-1': 9006,
  '710-1': 71002, '710-2': 71003, '710-3': 71004,
  '711-1': 71102, '711-2': 71103, '711-3': 71104,
}
const ATTRS: Record<string, NatureStat> = { H: 'help', F: 'ingredient', S: 'skill', E: 'exp', V: 'energy' }
const SKILLS: Record<string, string> = {
  fruitS: 'berryS', helperBonus: 'helpingBonus', speedS: 'helpS', speedM: 'helpM',
  ingS: 'ingS', ingM: 'ingM', invS: 'invS', invM: 'invM', invL: 'invL',
  skillS: 'skillS', skillM: 'skillM', lvS: 'skillLevelS', lvM: 'skillLevelM',
  expR: 'researchExp', expSleep: 'sleepExp', energy: 'energyRecover', dream: 'shardBonus',
}

export function parseIqdoohEntry(raw: Record<string, unknown>): BoxPokemon | null {
  const dex = String(raw.dex ?? '').match(/^#?(\d+)(?:-(\d+))?$/)
  if (!dex) return null
  const base = Number(dex[1])
  const pokeId = dex[2] ? FORMS[`${base}-${Number(dex[2])}`] : base
  const poke = pokeId ? pokeById(pokeId) : undefined
  if (!poke) return null
  const missing: OcrMissingField[] = ['skillLevel']
  const realLevel = Number(raw.levelReal ?? raw.level)
  const level = Number.isInteger(realLevel) && realLevel >= 1 && realLevel <= POKEMON_LEVEL_MAX ? realLevel : 1
  if (level !== realLevel) missing.push('level')
  const neutral = raw.incAttr == null && raw.decAttr == null
  const nature = neutral ? '勤奋' : NATURES.find(n =>
    n.up === ATTRS[String(raw.incAttr)] && n.down === ATTRS[String(raw.decAttr)] && n.up !== undefined)?.name
  if (!nature) missing.push('nature')
  const selected = Array.isArray(raw.selected) ? raw.selected : []
  const subskills = Array.from({ length: 5 }, (_, i) => {
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
