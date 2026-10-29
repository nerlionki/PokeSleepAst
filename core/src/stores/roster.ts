
import clientDefaults from '../data/client-defaults.resource'
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
  teams?: SavedTeam[]
  activeTeamId?: string
}
export interface SavedTeam { id: string; name: string; slots: (string | null)[]; customs: TeamCustom[]; tunes: Record<string, MemberTune> }

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
  const teams = ref<SavedTeam[]>([])
  const activeTeamId = ref('')
  function currentTeam(): SavedTeam {
    return cloneData({ id: activeTeamId.value, name: teams.value.find(team => team.id === activeTeamId.value)?.name ?? '我的队伍', slots: slots.value, customs: customs.value, tunes: tunes.value })
  }
  function teamList() { return teams.value.map(team => team.id === activeTeamId.value ? currentTeam() : team) }
  function selectTeam(id: string) {
    const target = teams.value.find(team => team.id === id)
    if (!target || id === activeTeamId.value) return
    teams.value = teamList()
    activeTeamId.value = id
    slots.value = five(target.slots)
    customs.value = cloneData(target.customs).map(item => ({ ...item, tune: { ...defaultTune(), ...item.tune } }))
    tunes.value = cloneData(target.tunes)
    error.value = ''
  }
  function createTeam() {
    const id = newUid()
    teams.value = [...teamList(), { id, name: `队伍 ${teams.value.length + 1}`, slots: five([]), customs: [], tunes: {} }]
    selectTeam(id)
    return id
  }
  function renameTeam(id: string, name: string) {
    teams.value = teams.value.map(team => team.id === id ? { ...team, name: name.trim() || '我的队伍' } : team)
  }
  function deleteTeam(id: string) {
    if (id === activeTeamId.value) {
      const next = teams.value.find(team => team.id !== id)
      if (next) selectTeam(next.id)
      else { activeTeamId.value = ''; slots.value = five([]); customs.value = []; tunes.value = {} }
    }
    teams.value = teams.value.filter(team => team.id !== id)
  }

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
      teams.value = Array.isArray(saved.teams) ? saved.teams.filter(team => team && typeof team.id === 'string').map(team => ({ ...team, slots: five(team.slots), customs: Array.isArray(team.customs) ? team.customs : [], tunes: team.tunes ?? {} })) : []
      activeTeamId.value = teams.value.some(team => team.id === saved.activeTeamId) ? saved.activeTeamId! : teams.value[0]?.id ?? ''
    }
    if (!teams.value.length && slots.value.some(Boolean)) {
      activeTeamId.value = newUid()
      teams.value = [currentTeam()]
    }
    ready.value = true
  }

  let saving = Promise.resolve()
  watch([slots, customs, tunes, teams, activeTeamId], () => {
    if (!ready.value) return
    const snapshot = cloneData({ slots: slots.value, customs: customs.value, tunes: tunes.value, teams: teamList(), activeTeamId: activeTeamId.value })
    saving = saving.then(() => saveJson('roster', snapshot)).catch(() => { error.value = '队伍未能保存，请检查本机存储空间。' })
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

  return { slots, customs, tunes, teams, activeTeamId, teamList, selectTeam, createTeam, renameTeam, deleteTeam, ready, error, hydrate, setSlot, addCustom, updateCustom, setTune, duplicateCustom }
})
