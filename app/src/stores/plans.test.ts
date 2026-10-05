import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_BABY_EFFICIENCY } from '../calc/babyEfficiency'
import { loadJson, saveJson } from '../storage'
import { usePlanStore } from './plans'

vi.mock('../storage', () => ({ loadJson: vi.fn(), saveJson: vi.fn() }))
beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })

describe('baby planner persisted settings', () => {
  it('migrates older saved plans and keeps their existing planning values', async () => {
    vi.mocked(loadJson).mockResolvedValue({ snorlaxStrength: 123456, catchGoals: [{ id: 'old', pokeId: 133, purpose: 'candy', stars: [] }] })
    const store = usePlanStore()
    await store.hydrate()
    expect(store.plan.snorlaxStrength).toBe(123456)
    expect(store.plan.catchGoals[0]?.id).toBe('old')
    expect(store.plan.babyEfficiency).toEqual(DEFAULT_BABY_EFFICIENCY)
    store.plan.babyEfficiency.precision = 'high'
    store.plan.babyEfficiency.eventMix = true
    await nextTick()
    expect(saveJson).toHaveBeenLastCalledWith('plans', expect.objectContaining({ babyEfficiency: expect.objectContaining({ precision: 'high', eventMix: true }) }))
  })

  it('loads valid saved settings and recovers invalid inputs', async () => {
    vi.mocked(loadJson).mockResolvedValue({ babyEfficiency: { pokeId: 133, precision: 'high', iterations: 10000, eventMix: true, eventMult: 1.5 } })
    const store = usePlanStore()
    await store.hydrate()
    expect(store.plan.babyEfficiency.pokeId).toBe(133)
    expect(store.plan.babyEfficiency.eventMix).toBe(true)
    vi.mocked(loadJson).mockResolvedValue({ babyEfficiency: { pokeId: 2, iterations: -1 } })
    await store.hydrate()
    expect(store.plan.babyEfficiency).toEqual(DEFAULT_BABY_EFFICIENCY)
  })
})
