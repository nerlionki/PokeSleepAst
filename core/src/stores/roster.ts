
import clientDefaults from '../data/client-defaults.json'
import { cloneData } from '../calc/dataClone'
import { newUid } from '../calc/uid'
import { teamRestrictionError } from '../calc/teamRestrictions'
import { useBoxStore } from './box'
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { defaultTune, type MemberTune } from '../calc/member'
import type { ProduceInput } from '../types'
import { loadJson, saveJson } from '../storage'
const stores_roster_config_clientDefaults = clientDefaults.modules.stores_roster


export interface TeamCustom extends ProduceInput {
  uid: string
  tune: MemberTune
}

interface RosterFile {
  slots: (string | null)[]
  customs: TeamCustom[]
  tunes: Record<string, MemberTune>
}

function five(slots: unknown): (string | null)[] {
  const list = Array.isArray(slots) ? slots.slice(0, 5) : []
  while (list.length < 5) list.push(null)
  return list.map((slot) => (typeof slot === 'string' ? slot : null))
}

export const useRosterStore = defineStore('roster', () => {
  const slots = ref<(string | null)[]>((cloneData(stores_roster_config_clientDefaults["slotsInitial"]) as unknown as (string | null)[]))
  const customs = ref<TeamCustom[]>((cloneData(stores_roster_config_clientDefaults["customsInitial"]) as unknown as TeamCustom[]))
  const tunes = ref<Record<string, MemberTune>>((cloneData(stores_roster_config_clientDefaults["tunesInitial"]) as unknown as Record<string, MemberTune>))
  const ready = ref(stores_roster_config_clientDefaults["readyInitial"])
  const error = ref(stores_roster_config_clientDefaults["errorInitial"])

  function memberOf(uid: string | null) {
    return customs.value.find(item => item.uid === uid) ?? useBoxStore().pokemon.find(item => item.uid === uid)
  }

  function canPlace(index: number, pokeId: number) {
    const others = slots.value.flatMap((uid, slot) => {
      const member = slot === index ? undefined : memberOf(uid)
      return member ? [member] : []
    })
    error.value = teamRestrictionError([...others, { pokeId }])
    return !error.value
  }

  async function hydrate() {
    const saved = await loadJson<RosterFile | (string | null)[] | null>('roster', null)
    if (Array.isArray(saved)) slots.value = five(saved)
    else if (saved && typeof saved === 'object') {
      slots.value = five(saved.slots)
      customs.value = Array.isArray(saved.customs) ? saved.customs.map((item) => ({ ...item, tune: { ...defaultTune(), ...item.tune } })) : []
      tunes.value = saved.tunes && typeof saved.tunes === 'object' ? saved.tunes : {}
    }
    ready.value = true
  }

  watch([slots, customs, tunes], () => {
    if (!ready.value) return
    void saveJson('roster', { slots: slots.value, customs: customs.value, tunes: tunes.value })
  }, { deep: true })

  function setSlot(index: number, uid: string | null) {
    const member = memberOf(uid)
    if (member && !canPlace(index, member.pokeId)) return false
    error.value = ''
    const next = [...slots.value]
    next[index] = uid
    slots.value = next
    pruneCustoms()
    return true
  }

  function pruneCustoms() {
    const used = new Set(slots.value)
    customs.value = customs.value.filter((item) => used.has(item.uid))
  }

  function addCustom(index: number, pokeId: number) {
    if (!canPlace(index, pokeId)) return null
    const uid = `custom-${newUid()}`
    const member: TeamCustom = {
      uid,
      pokeId,
      level: 30,
      nature: '勤奋',
      subskills: ['', '', '', '', ''],
      ingredientSlots: [0, 1, 2],
      skillLevel: 1,
      tune: defaultTune(),
    }
    customs.value = [...customs.value, member]
    setSlot(index, uid)
    return uid
  }

  function updateCustom(uid: string, patch: Partial<TeamCustom>) {
    customs.value = customs.value.map((item) => (item.uid === uid ? { ...item, ...patch, uid, tune: { ...item.tune, ...patch.tune } } : item))
  }

  function setTune(uid: string, tune: MemberTune) {
    tunes.value = { ...tunes.value, [uid]: tune }
  }

  function duplicateCustom(uid: string) {
    const source = customs.value.find((item) => item.uid === uid)
    const empty = slots.value.findIndex((slot) => !slot)
    if (!source || empty < 0) return null
    if (!canPlace(empty, source.pokeId)) return null
    const copy: TeamCustom = {
      ...source,
      subskills: [...source.subskills],
      ingredientSlots: [source.ingredientSlots[0], source.ingredientSlots[1], source.ingredientSlots[2]],
      tune: { ...source.tune },
      uid: `custom-${newUid()}`,
    }
    customs.value = [...customs.value, copy]
    setSlot(empty, copy.uid)
    return copy.uid
  }

  return { slots, customs, tunes, ready, error, hydrate, setSlot, addCustom, updateCustom, setTune, duplicateCustom }
})
