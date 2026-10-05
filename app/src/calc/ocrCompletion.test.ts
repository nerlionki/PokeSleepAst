import { describe, expect, it } from 'vitest'
import { completeOcrFields, normalizeOcrMissing, ocrChoices } from './ocrCompletion'
import { parseCard, planImports } from './ocrBox'
import { parseBoxImport } from './boxio'
import type { BoxPokemon } from '../types'

function incomplete(): BoxPokemon {
  return { uid: 'ocr-one', ...parseCard([], { portraitId: 25, slotLines: [null, null] })! }
}

describe('OCR missing fields', () => {
  it('marks missing numeric values and food defaults instead of treating defaults as recognized', () => {
    const pokemon = incomplete()
    expect(pokemon.level).toBe(30)
    expect(pokemon.nature).toBe('勤奋')
    expect(pokemon.ingredientSlots).toEqual([0, 1, 2])
    expect(pokemon.ocrMissing).toEqual(['level', 'nature', 'skillLevel', 'ingredient1', 'ingredient2',
      'subskill0', 'subskill1', 'subskill2', 'subskill3', 'subskill4'])
    expect(pokemon.ocrMissing).not.toContain('ingredient0')
  })
  it('does not mark recognized values, even when they match defaults', () => {
    const pokemon = parseCard([
      { text: 'Lv.30', x: 10, y: 10, width: 70, height: 30 },
      { text: '皮卡丘', x: 100, y: 10, width: 80, height: 30 },
      { text: 'Lv.1', x: 250, y: 160, width: 70, height: 25 },
      { text: '勤奋', x: 30, y: 400, width: 80, height: 30 },
    ], { portraitId: 25, slotLines: [1, 2] })!
    expect(pokemon.ocrMissing).not.toContain('level')
    expect(pokemon.ocrMissing).not.toContain('nature')
    expect(pokemon.ocrMissing).not.toContain('skillLevel')
    expect(pokemon.ocrMissing).not.toContain('ingredient1')
    expect(pokemon.ocrMissing).not.toContain('ingredient2')
  })
  it('still discards unknown species and distinguishes incomplete records during deduplication', () => {
    expect(parseCard([], { portraitId: null, slotLines: [null, null] })).toBeNull()
    const pokemon = incomplete()
    const { ocrMissing: _missing, ...known } = pokemon
    expect(planImports([known], [pokemon, pokemon, null])).toMatchObject({ skipped: 1, discarded: 1 })
    expect(planImports([known], [pokemon]).accepted).toHaveLength(1)
  })
  it('requires explicit selections, supports partial completion, and preserves recognized content', () => {
    const pokemon = incomplete()
    pokemon.name = '闪电'
    expect(completeOcrFields(pokemon, {})).toEqual(pokemon)
    const partial = completeOcrFields(pokemon, { level: '30', nature: '固执' })
    expect(partial.level).toBe(30)
    expect(partial.nature).toBe('固执')
    expect(partial.name).toBe('闪电')
    expect(partial.ocrMissing).not.toContain('level')
    expect(partial.ocrMissing).not.toContain('nature')
    expect(partial.ocrMissing).toContain('skillLevel')
    expect(pokemon.nature).toBe('勤奋')
  })
  it('rejects invalid levels, disallowed foods and duplicate subskills', () => {
    const pokemon = incomplete()
    const invalid = completeOcrFields(pokemon, { level: '0', skillLevel: '999', ingredient1: '999',
      subskill0: 'helpS', subskill1: 'helpS' })
    expect(invalid.ocrMissing).toEqual(pokemon.ocrMissing)
    const known = { ...pokemon, subskills: ['helpS', '', '', '', ''], ocrMissing: ['subskill1'] as const }
    expect(completeOcrFields({ ...known, ocrMissing: [...known.ocrMissing] }, { subskill1: 'helpS' }).ocrMissing).toEqual(['subskill1'])
  })
  it('clears all flags only when every missing field has a valid explicit selection', () => {
    const pokemon = incomplete()
    const complete = completeOcrFields(pokemon, { level: '30', nature: '勤奋', skillLevel: '1', ingredient1: '1', ingredient2: '2',
      subskill0: 'helpS', subskill1: 'helpM', subskill2: 'ingS', subskill3: 'ingM', subskill4: 'skillS' })
    expect(complete.ocrMissing).toBeUndefined()
    expect(complete.subskills).toEqual(['helpS', 'helpM', 'ingS', 'ingM', 'skillS'])
  })
  it('allows explicit empty food choices only for all rounders', () => {
    const mew = { uid: 'mew', ...parseCard([], { portraitId: 151, slotLines: [null, null] })! }
    expect(mew.ocrMissing).toContain('ingredient0')
    expect(ocrChoices(mew, 'ingredient2').some((choice) => choice.value === 'empty')).toBe(true)
    const partial = completeOcrFields(mew, { ingredient2: 'empty' })
    expect(partial.ingredientSlots[2]).toBeNull()
    expect(partial.ocrMissing).not.toContain('ingredient2')
    expect(completeOcrFields(incomplete(), { ingredient2: 'empty' }).ocrMissing).toContain('ingredient2')
  })
  it('retains missing flags in native backup imports and filters invalid markers', () => {
    const pokemon = incomplete()
    expect(parseBoxImport({ schemaVersion: 1, pokemon: [pokemon] }).pokemon[0]?.ocrMissing).toEqual(pokemon.ocrMissing)
    expect(normalizeOcrMissing(['level', 'level', 'bad', null, 'constructor'])).toEqual(['level'])
  })
})
