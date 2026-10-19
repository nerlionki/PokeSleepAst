import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_BABY_EFFICIENCY, DEFAULT_COMPLETION_EFFICIENCY } from '../calc/babyEfficiency'
import { loadJson, saveJson } from '../storage'
import { usePlanStore } from './plans'

vi.mock('../storage', () => ({ loadJson: vi.fn(), saveJson: vi.fn() }))
beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })

describe('baby planner persisted settings', () => {
  it('migrates old plans and persists completion settings independently', async () => {
    vi.mocked(loadJson).mockResolvedValue({})
    const store = usePlanStore()
    await store.hydrate()
    expect(store.plan.completionEfficiency).toEqual(DEFAULT_COMPLETION_EFFICIENCY)
    store.plan.completionEfficiency = { ...DEFAULT_COMPLETION_EFFICIENCY, pokeId: 160, completionTarget: '160-4', eventMult: 2 }
    await nextTick()
    expect(store.plan.babyEfficiency).toEqual(DEFAULT_BABY_EFFICIENCY)
    expect(saveJson).toHaveBeenLastCalledWith('plans', expect.objectContaining({ completionEfficiency: expect.objectContaining({ completionTarget: '160-4', eventMult: 2 }) }))
    vi.mocked(loadJson).mockResolvedValue({ completionEfficiency: store.plan.completionEfficiency })
    await store.hydrate()
    expect(store.plan.completionEfficiency.completionTarget).toBe('160-4')
  })
  it('migrates a saved Pumpkaboo size while retaining panel settings', async () => {
    vi.mocked(loadJson).mockResolvedValue({ babyEfficiency: { ...DEFAULT_BABY_EFFICIENCY, pokeId: 71003, eventMult: 1.5, splitSleep: false } })
    const store = usePlanStore()
    await store.hydrate()
    expect(store.plan.babyEfficiency).toEqual({ ...DEFAULT_BABY_EFFICIENCY, pokeId: 710, eventMult: 1.5, splitSleep: false })
  })
  it('hydrates and persists legacy candy stocks using each family maximum', async () => {
    vi.mocked(loadJson).mockResolvedValue({ candyStocks: { '1': 20, '9001': 50, '9007': 30, '133': 42, '7006': 15 } })
    const store = usePlanStore()
    await store.hydrate()
    await nextTick()
    expect(store.plan.candyStocks).toEqual({ '1': 50, '133': 42 })
    expect(saveJson).toHaveBeenLastCalledWith('plans', expect.objectContaining({ candyStocks: { '1': 50, '133': 42 } }))
  })
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
