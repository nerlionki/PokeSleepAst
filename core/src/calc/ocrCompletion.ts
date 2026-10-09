import type { BoxPokemon, OcrMissingField } from '../types'
import { NATURES, SUBSKILLS, pokeById } from './data'
import { ingredientColumns } from './ingredients'
import { skillMaxFor } from './mainSkills'
import { isAllRounder } from './specialty'
import { POKEMON_LEVEL_MAX } from './xp'

export const OCR_FIELD_LABELS: Record<OcrMissingField, string> = {
  level: '宝可梦等级', nature: '性格', skillLevel: '主技能等级',
  ingredient0: '第 1 槽食材', ingredient1: '第 2 槽食材（Lv.30）', ingredient2: '第 3 槽食材（Lv.60）',
  subskill0: '第 1 个副技能', subskill1: '第 2 个副技能', subskill2: '第 3 个副技能',
  subskill3: '第 4 个副技能', subskill4: '第 5 个副技能',
}

export function normalizeOcrMissing(raw: unknown): OcrMissingField[] {
  return Array.isArray(raw) ? [...new Set(raw.filter((field): field is OcrMissingField =>
    typeof field === 'string' && Object.hasOwn(OCR_FIELD_LABELS, field)))] : []
}

export type OcrSelections = Partial<Record<OcrMissingField, string>>

export function ocrChoices(pokemon: BoxPokemon, field: OcrMissingField) {
  const poke = pokeById(pokemon.pokeId)
  if (field === 'nature') return NATURES.map((item) => ({ value: item.name, label: item.name }))
  if (field.startsWith('subskill')) return SUBSKILLS.map((item) => ({ value: item.id, label: item.name }))
  if (field.startsWith('ingredient')) {
    const column = Number(field.at(-1))
    const cells = poke ? ingredientColumns(poke.ingredients)[column] ?? [] : []
    return [
      ...(isAllRounder(poke) ? [{ value: 'empty', label: '空（确认未选择食材）' }] : []),
      ...cells.map((cell) => ({ value: String(cell.index), label: `${cell.name} ×${cell.amount}` })),
    ]
  }
  return []
}

/** Only explicit, valid selections clear missing flags; defaults are never confirmed implicitly. */
export function completeOcrFields(pokemon: BoxPokemon, selections: OcrSelections): BoxPokemon {
  const result: BoxPokemon = { ...pokemon, subskills: [...pokemon.subskills], ingredientSlots: [...pokemon.ingredientSlots] }
  const unresolved = normalizeOcrMissing(pokemon.ocrMissing)
  const selectedSkills = unresolved.filter((field) => field.startsWith('subskill'))
    .map((field) => selections[field]).filter(Boolean)
  result.ocrMissing = unresolved.filter((field) => {
    const value = selections[field]
    if (value == null || value === '') return true
    if (field === 'level' || field === 'skillLevel') {
      const number = Number(value)
      const max = field === 'level' ? POKEMON_LEVEL_MAX : skillMaxFor(pokeById(pokemon.pokeId)?.mainSkill ?? '')
      if (!Number.isInteger(number) || number < 1 || number > max) return true
      result[field] = number
    } else {
      if (!ocrChoices(pokemon, field).some((choice) => choice.value === value)) return true
      if (field === 'nature') result.nature = value
      else if (field.startsWith('ingredient')) result.ingredientSlots[Number(field.at(-1)) as 0 | 1 | 2] = value === 'empty' ? null : Number(value)
      else {
        const index = Number(field.at(-1))
        const duplicate = pokemon.subskills.some((skill, slot) => slot !== index && skill === value)
          || selectedSkills.filter((skill) => skill === value).length > 1
        if (duplicate) return true
        result.subskills[index] = value
      }
    }
    return false
  })
  if (!result.ocrMissing.length) delete result.ocrMissing
  return result
}

/** Confirm only the field explicitly touched in the manual editor; untouched OCR defaults stay unresolved. */
export function confirmEditedOcrField<T extends BoxPokemon>(pokemon: T, field: OcrMissingField): T {
  if (!normalizeOcrMissing(pokemon.ocrMissing).includes(field)) return pokemon
  const value = field.startsWith('subskill') ? pokemon.subskills[Number(field.at(-1))]
    : field.startsWith('ingredient') ? pokemon.ingredientSlots[Number(field.at(-1)) as 0 | 1 | 2]
    : pokemon[field as 'level' | 'nature' | 'skillLevel']
  const selection = value == null && field.startsWith('ingredient') ? 'empty' : String(value ?? '')
  return completeOcrFields(pokemon, { [field]: selection }) as T
}
