import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { canPickBerries, defaultSettings, EX_MAIN, helpMaxSettings, idealSettings, mergeSettings, normalizeEx2Berries, work18Settings } from '../calc/defaults'
import { BERRIES, ISLANDS } from '../calc/data'
import { loadJson, saveJson } from '../storage'
import type { Settings } from '../types'

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<Settings>(defaultSettings())
  const ready = ref(false)

  async function hydrate() {
    settings.value = mergeSettings(await loadJson('settings', defaultSettings()))
    if (!canPickBerries(settings.value.island)) {
      const island = ISLANDS.find((i) => i.id === settings.value.island)
      if (island?.berries.length) settings.value.berries = [...island.berries]
    }
    ready.value = true
  }

  watch(() => settings.value.areaBonus, value => {
    settings.value.islandBonuses = { ...settings.value.islandBonuses, [settings.value.island]: Math.min(0.85, Math.max(0, Number(value) || 0)) }
  }, { flush: 'sync' })

  function islandBonus(id: Settings['island']) { return settings.value.islandBonuses?.[id] ?? (id === settings.value.island ? settings.value.areaBonus : 0) }
  function setIslandBonus(id: Settings['island'], value: number) {
    const bonus = Math.min(0.85, Math.max(0, Number(value) || 0))
    settings.value.islandBonuses = { ...settings.value.islandBonuses, [id]: bonus }
    if (id === settings.value.island) settings.value.areaBonus = bonus
  }

  watch(settings, (v) => {
    if (ready.value) void saveJson('settings', v)
  }, { deep: true })

  function applyIsland(id: Settings['island']) {
    const island = ISLANDS.find((i) => i.id === id)
    const nextBonus = islandBonus(id)
    settings.value.island = id
    settings.value.areaBonus = nextBonus
    if (id === 'cyanex') settings.value.berries = normalizeEx2Berries(settings.value.berries)
    if (!canPickBerries(id) && island?.berries.length) settings.value.berries = [...island.berries]
    if (island?.pot) settings.value.potSize = island.pot
  }

  function setEx2MainBerry(name: string) {
    if (settings.value.island !== 'cyanex' || !EX_MAIN.includes(name)) return
    const current = normalizeEx2Berries(settings.value.berries)
    settings.value.berries = [name, ...current.slice(1).filter(berry => berry !== name)]
  }

  function toggleBerry(name: string) {
    if (!canPickBerries(settings.value.island)) return
    if (settings.value.island === 'cyanex' && !BERRIES.some(berry => berry.name === name)) return
    const current = settings.value.berries
    if (settings.value.island === 'cyanex' && name === current[0]) return
    if (current.includes(name)) settings.value.berries = current.filter(berry => berry !== name)
    else if (current.length < 3) settings.value.berries = [...current, name]
  }

  function setEnvironment(patch: Partial<Pick<Settings, 'island' | 'berries' | 'helpingBonus' | 'exBuff' | 'exDebuff' | 'exWeeklyBonus'>>) {
    if (patch.island) applyIsland(patch.island)
    if (patch.berries) settings.value.berries = settings.value.island === 'cyanex' ? normalizeEx2Berries(patch.berries) : [...new Set(patch.berries)].slice(0, 3)
    if (patch.helpingBonus != null) settings.value.helpingBonus = Math.min(5, Math.max(0, Math.floor(Number(patch.helpingBonus) || 0)))
    if (patch.exBuff != null) settings.value.exBuff = patch.exBuff
    if (patch.exDebuff != null) settings.value.exDebuff = patch.exDebuff
    if (patch.exWeeklyBonus != null) settings.value.exWeeklyBonus = patch.exWeeklyBonus
  }

  function reset() {
    settings.value = defaultSettings()
  }

  function applyPreset(name: 'default' | 'ideal' | 'work18' | 'helpMax') {
    const next = name === 'ideal'
      ? idealSettings()
      : name === 'work18'
        ? work18Settings()
        : name === 'helpMax'
          ? helpMaxSettings()
          : defaultSettings()
    settings.value = {
      ...next,
      island: settings.value.island,
      berries: settings.value.berries,
      areaBonus: settings.value.areaBonus,
      islandBonuses: { ...settings.value.islandBonuses },
      exBuff: settings.value.exBuff,
      exDebuff: settings.value.exDebuff,
      exWeeklyBonus: settings.value.exWeeklyBonus,
      mealCategory: settings.value.mealCategory,
      potSize: settings.value.potSize,
    }
  }

  const summary = computed(() => {
    const s = settings.value
    const name = ISLANDS.find((i) => i.id === s.island)?.name ?? s.island
    return `${name} · 营地 ${Math.round(s.areaBonus * 100)}% · ${s.sleepStart}–${s.sleepEnd} / ${s.sleepScore}分 · 三餐${s.meals ? '开' : '关'}`
  })

  return { settings, ready, hydrate, applyIsland, setEx2MainBerry, toggleBerry, reset, applyPreset, summary, islandBonus, setIslandBonus, setEnvironment }
})
