import type { BoxPokemon } from '../types'
import { defaultTune, type MemberDraft } from './member'

/** Copy editable collections while retaining caller-owned identity and metadata. */
export function cloneMemberDraft<T extends MemberDraft>(draft: T): T {
  return { ...draft, subskills: [...draft.subskills], ingredientSlots: [...draft.ingredientSlots], tune: { ...draft.tune } }
}

/** A saved individual becomes an isolated editor draft; missing tuning uses editor defaults. */
export function memberDraftFromBox(pokemon: BoxPokemon): MemberDraft {
  return cloneMemberDraft({ pokeId: pokemon.pokeId, level: pokemon.level, nature: pokemon.nature,
    subskills: pokemon.subskills, ingredientSlots: pokemon.ingredientSlots, skillLevel: pokemon.skillLevel,
    mewSkill: pokemon.mewSkill, tune: { ...defaultTune(), ...pokemon.tune } })
}

/** Persist only individual fields, never comparison IDs or temporary simulation overrides. */
export function memberDraftToBox(draft: MemberDraft): Omit<BoxPokemon, 'uid'> {
  const copy = cloneMemberDraft(draft)
  return { pokeId: copy.pokeId, level: copy.level, nature: copy.nature, subskills: copy.subskills,
    ingredientSlots: copy.ingredientSlots, skillLevel: copy.skillLevel, mewSkill: copy.mewSkill,
    name: '', napping: false, tune: copy.tune }
}
