
import clientDefaults from '../data/client-defaults.resource'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { appearancePalette, appearanceVariables, defaultAppearance, normalizeAppearance } from '../ui/appearance'
import type { Appearance } from '../ui/appearance'
import { loadJson, saveJson } from '../storage'
const stores_appearance_config_clientDefaults = clientDefaults.modules.stores_appearance


export const useAppearanceStore = defineStore('appearance', () => {
  const settings = ref(defaultAppearance())
  const error = ref(stores_appearance_config_clientDefaults["errorInitial"])
  const palette = computed(() => appearancePalette(settings.value))
  const variables = computed(() => appearanceVariables(settings.value))
  let loading: Promise<void> | undefined
  let saving = Promise.resolve()
  function hydrate() {
    return loading ??= loadJson('appearance', defaultAppearance()).then(value => { settings.value = normalizeAppearance(value) })
  }
  function update(value: Appearance) {
    settings.value = normalizeAppearance(value)
    const snapshot = JSON.parse(JSON.stringify(settings.value)) as Appearance
    saving = saving.then(() => saveJson('appearance', snapshot)).then(() => { error.value = '' }, () => { error.value = '外观已应用，但未能保存到本机，请重试。' })
    return saving
  }
  function reset() { return update(defaultAppearance()) }
  return { settings, palette, variables, error, hydrate, update, reset }
})
