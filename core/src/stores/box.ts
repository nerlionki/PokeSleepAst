import { newUid } from '../calc/uid'
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { loadJson, saveJson } from '../storage'
import type { BoxPokemon } from '../types'
import { normalizeOcrMissing } from '../calc/ocrCompletion'

function adopt(item: BoxPokemon & { note?: string }): BoxPokemon {
  const name = item.name ?? item.note ?? ''
  return {
    uid: item.uid || newUid(),
    pokeId: item.pokeId,
    level: item.level,
    nature: item.nature,
    subskills: item.subskills ?? ['', '', '', '', ''],
    ingredientSlots: item.ingredientSlots,
    skillLevel: item.skillLevel,
    name,
    napping: Boolean(item.napping),
    ...(item.shiny ? { shiny: true } : {}),
    tune: item.tune,
    ...(normalizeOcrMissing(item.ocrMissing).length ? { ocrMissing: normalizeOcrMissing(item.ocrMissing) } : {}),
  }
}

export interface BoxFile {
  schemaVersion: 1
  pokemon: BoxPokemon[]
}

export const useBoxStore = defineStore('box', () => {
  const pokemon = ref<BoxPokemon[]>([])
  const ready = ref(false)

  async function hydrate() {
    const file = await loadJson<BoxFile>('box', { schemaVersion: 1, pokemon: [] })
    pokemon.value = (file.pokemon ?? []).map((item) => adopt(item))
    ready.value = true
    void saveJson('box', { schemaVersion: 1, pokemon: pokemon.value })
  }

  watch(pokemon, (list) => {
    if (ready.value) void saveJson('box', { schemaVersion: 1, pokemon: list })
  }, { deep: true })

  function create(partial: Omit<BoxPokemon, 'uid'> & { uid?: string }) {
    const item: BoxPokemon = {
      uid: partial.uid || newUid(),
      pokeId: partial.pokeId,
      level: partial.level,
      nature: partial.nature,
      subskills: partial.subskills,
      ingredientSlots: partial.ingredientSlots,
      skillLevel: partial.skillLevel,
      name: partial.name ?? '',
      napping: partial.napping,
      ...(partial.shiny ? { shiny: true } : {}),
      tune: partial.tune,
      ...(normalizeOcrMissing(partial.ocrMissing).length ? { ocrMissing: normalizeOcrMissing(partial.ocrMissing) } : {}),
    }
    pokemon.value = [...pokemon.value, item]
    return item
  }

  function update(uid: string, patch: Partial<BoxPokemon>) {
    const current = pokemon.value.find((p) => p.uid === uid)
    if (!current) return
    pokemon.value = [
      ...pokemon.value.filter((p) => p.uid !== uid),
      { ...current, ...patch, uid },
    ]
  }

  function remove(uid: string) {
    pokemon.value = pokemon.value.filter((p) => p.uid !== uid)
  }

  function replaceAll(list: BoxPokemon[]) {
    pokemon.value = list
  }

  function merge(list: BoxPokemon[]) {
    let merged = [...pokemon.value]
    for (const p of list) merged = [...merged.filter((item) => item.uid !== p.uid), p]
    pokemon.value = merged
  }

  function exportFile(): BoxFile {
    return { schemaVersion: 1, pokemon: pokemon.value }
  }

  return { pokemon, ready, hydrate, create, update, remove, replaceAll, merge, exportFile }
})
