import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { BERRIES } from '../calc/data'
import { EX_MAIN, mergeSettings } from '../calc/defaults'
import { useSettingsStore } from './settings'

const saved = vi.hoisted(() => ({ settings: null as unknown }))
vi.mock('#platform/storage', () => ({
  loadJson: async (_key: string, fallback: unknown) => saved.settings ?? fallback,
  saveJson: async () => {},
}))

describe('EX2 berry preferences', () => {
  beforeEach(() => { setActivePinia(createPinia()); saved.settings = null })

  it.each(EX_MAIN)('allows %s as the main and each pair from the other 17 berries', main => {
    const store = useSettingsStore()
    store.applyIsland('cyanex')
    const secondary = BERRIES.filter(berry => berry.name !== main)
    expect(secondary).toHaveLength(17)
    for (let a = 0; a < secondary.length; a++) {
      for (let b = a + 1; b < secondary.length; b++) {
        store.settings.berries = [main]
        store.toggleBerry(secondary[a]!.name)
        store.toggleBerry(secondary[b]!.name)
        expect(store.settings.berries).toEqual([main, secondary[a]!.name, secondary[b]!.name])
      }
    }
  })

  it('keeps the main selected, caps secondary choices at two and removes overlap when changing the main', () => {
    const store = useSettingsStore(); store.applyIsland('cyanex')
    store.settings.berries = ['椰木果', '橙橙果', '桃桃果']
    store.toggleBerry('椰木果')
    store.toggleBerry('柿仔果')
    expect(store.settings.berries).toEqual(['椰木果', '橙橙果', '桃桃果'])
    store.setEx2MainBerry('橙橙果')
    expect(store.settings.berries).toEqual(['橙橙果', '桃桃果'])
    store.toggleBerry('无效树果')
    expect(store.settings.berries).toEqual(['橙橙果', '桃桃果'])
    store.toggleBerry('椰木果')
    expect(store.settings.berries).toEqual(['橙橙果', '桃桃果', '椰木果'])
    store.setEx2MainBerry('柿仔果')
    expect(store.settings.berries[0]).toBe('橙橙果')
  })

  it('repairs old EX2 preferences on hydration while preserving valid secondary choices', async () => {
    saved.settings = { island: 'cyanex', berries: ['柿仔果', '椰木果', '金枕果'] }
    const store = useSettingsStore(); await store.hydrate()
    expect(store.settings.berries).toEqual(['椰木果', '柿仔果', '金枕果'])
    expect(mergeSettings({ island: 'cyanex', berries: ['无效', '柿仔果', '柿仔果', '金枕果'] }).berries)
      .toEqual([EX_MAIN[0], '柿仔果', '金枕果'])
  })

  it('enforces the rule on island entry and leaves the other editable islands unrestricted', () => {
    const store = useSettingsStore()
    store.settings.berries = ['柿仔果', '金枕果', '萄葡果']
    store.applyIsland('cyanex')
    expect(EX_MAIN).toContain(store.settings.berries[0])
    expect(store.settings.berries).toHaveLength(3)
    for (const island of ['greengrass', 'greenex'] as const) {
      store.applyIsland(island); store.settings.berries = []
      for (const name of ['柿仔果', '金枕果', '萄葡果']) store.toggleBerry(name)
      expect(store.settings.berries).toEqual(['柿仔果', '金枕果', '萄葡果'])
    }
  })
})
