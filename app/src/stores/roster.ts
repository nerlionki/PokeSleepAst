import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { defaultTune, type MemberTune } from '../calc/member'
import type { ProduceInput } from '../types'
import { loadJson, saveJson } from '../storage'

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
  const slots = ref<(string | null)[]>([null, null, null, null, null])
  const customs = ref<TeamCustom[]>([])
  const tunes = ref<Record<string, MemberTune>>({})
  const ready = ref(false)

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
    const next = [...slots.value]
    next[index] = uid
    slots.value = next
    pruneCustoms()
  }

  function pruneCustoms() {
    const used = new Set(slots.value)
    customs.value = customs.value.filter((item) => used.has(item.uid))
  }

  function addCustom(index: number, pokeId: number) {
    const uid = `custom-${crypto.randomUUID()}`
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
    const copy: TeamCustom = {
      ...source,
      subskills: [...source.subskills],
      ingredientSlots: [source.ingredientSlots[0], source.ingredientSlots[1], source.ingredientSlots[2]],
      tune: { ...source.tune },
      uid: `custom-${crypto.randomUUID()}`,
    }
    customs.value = [...customs.value, copy]
    setSlot(empty, copy.uid)
    return copy.uid
  }

  return { slots, customs, tunes, ready, hydrate, setSlot, addCustom, updateCustom, setTune, duplicateCustom }
})
