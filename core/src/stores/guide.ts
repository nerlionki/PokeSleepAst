import { defineStore } from 'pinia'
import { ref } from 'vue'
import { loadJson, saveJson } from '../storage'
import type { GuidePage } from '../ui/guide'

const STORAGE_KEY = 'onboarding-v1'

export const useGuideStore = defineStore('guide', () => {
  const mode = ref<'overview' | 'page' | null>(null)
  const step = ref(0)
  const page = ref<GuidePage>('pokemon')
  const navigating = ref(false)
  const error = ref('')
  let loading: Promise<void> | undefined
  let interacted = false

  function initialize() {
    return loading ??= loadJson<unknown>(STORAGE_KEY, false).then(seen => {
      if (seen !== true && !interacted) { step.value = 0; mode.value = 'overview' }
    }).catch(() => {
      // An unreadable preference must never prevent access to the app.
      error.value = '引导状态无法读取，仍可手动查看引导。'
    })
  }

  function openPage(value: GuidePage = 'pokemon') { interacted = true; page.value = value; mode.value = 'page' }
  function openOverview() { interacted = true; step.value = 0; mode.value = 'overview' }
  async function dismiss() {
    interacted = true
    mode.value = null
    try { await saveJson(STORAGE_KEY, true); error.value = '' }
    catch { error.value = '引导状态未能保存，下次启动可能再次显示。' }
  }

  return { mode, step, page, navigating, error, initialize, openPage, openOverview, dismiss }
})
