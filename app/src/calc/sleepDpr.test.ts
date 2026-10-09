import { describe, expect, it } from 'vitest'
import { SLEEP_STYLES } from './data'
import { drowsyPower, rankFromStrength, sleepDraw } from './sleep'
describe('EX2 Suicune with corrected DPR', () => {
  it('preserves EX2 reference data and only estimates missing stars from EX1', () => {
    const styles = SLEEP_STYLES.filter(s => s.island === 'cyanex' && s.pokeId === 245)
    expect(styles.map(s => [s.stars, s.dpr, s.dprEstimated])).toEqual([
      [1, 154660000, false], [2, 354082868, true], [3, 655930449, true],
    ])
  })
  it('cannot select three-star Suicune at 7.5m energy and score 80, even as terminal fallback', () => {
    const styles = SLEEP_STYLES.filter(s => s.island === 'cyanex' && s.pokeId === 245)
    const power = drowsyPower(80, 7500000, 1)
    expect(power).toBe(600000000)
    expect(styles.find(s => s.stars === 3)!.dpr).toBeGreaterThan(power)
    for (const mode of ['off', 'some', 'all'] as const) {
      const draw = sleepDraw('cyanex', '深深入眠', power, rankFromStrength('cyanex', 7500000), 'normal', () => 0.9,
        { pool: styles, openPool: styles, eventMix: mode, undiscoveredBoost: false })
      expect(draw.some(s => s.pokeId === 245 && s.stars === 3)).toBe(false)
    }
  })
})
