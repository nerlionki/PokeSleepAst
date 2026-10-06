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

  watch(settings, (v) => {
    if (ready.value) void saveJson('settings', v)
  }, { deep: true })

  function applyIsland(id: Settings['island']) {
    const island = ISLANDS.find((i) => i.id === id)
    settings.value.island = id
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
      mealCategory: settings.value.mealCategory,
      potSize: settings.value.potSize,
    }
  }

  const summary = computed(() => {
    const s = settings.value
    const name = ISLANDS.find((i) => i.id === s.island)?.name ?? s.island
    return `${name} · 营地 ${Math.round(s.areaBonus * 100)}% · ${s.sleepStart}–${s.sleepEnd} / ${s.sleepScore}分 · 三餐${s.meals ? '开' : '关'}`
  })

  return { settings, ready, hydrate, applyIsland, setEx2MainBerry, toggleBerry, reset, applyPreset, summary }
})
