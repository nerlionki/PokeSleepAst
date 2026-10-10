import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useSettingsStore } from '../../../core/src/stores/settings'
import { mergeSettings } from '../../../core/src/calc/defaults'
vi.mock('#platform/storage', () => ({ loadJson: async (_key: string, fallback: unknown) => fallback, saveJson: async () => {} }))
beforeEach(() => setActivePinia(createPinia()))
describe('per-island bonuses', () => {
  it('migrates the existing bonus only to the saved current island', () => {
    const s = mergeSettings({ island: 'cyan', areaBonus: 0.4 })
    expect(s.islandBonuses?.cyan).toBe(0.4)
    expect(s.islandBonuses?.greengrass).toBeUndefined()
  })
  it('editing another island preserves current selection and applies when switching', () => {
    const store = useSettingsStore()
    store.setIslandBonus('greengrass', 0.25)
    store.setIslandBonus('cyan', 0.5)
    expect(store.settings.island).toBe('greengrass')
    expect(store.settings.areaBonus).toBe(0.25)
    store.applyIsland('cyan')
    expect(store.settings.areaBonus).toBe(0.5)
    store.applyIsland('greengrass')
    expect(store.settings.areaBonus).toBe(0.25)
  })
  it('global changes update only the active island and clamp unsupported values', () => {
    const store = useSettingsStore()
    store.settings.areaBonus = 0.3
    expect(store.islandBonus('greengrass')).toBe(0.3)
    store.setIslandBonus('cyan', 3)
    expect(store.islandBonus('cyan')).toBe(0.85)
    store.setEnvironment({ helpingBonus: 8, exWeeklyBonus: 'skills', exBuff: false })
    expect(store.settings.helpingBonus).toBe(5)
    expect(store.settings.exWeeklyBonus).toBe('skills')
    expect(store.settings.exBuff).toBe(false)
  })
})
