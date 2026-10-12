import { describe, expect, it } from 'vitest'
import { performance } from 'node:perf_hooks'
import { writeFileSync } from 'node:fs'
import { cpus } from 'node:os'
import { defaultSettings } from '../../../core/src/calc/defaults'
import { islandById } from '../../../core/src/calc/data'
import { defaultScoreOptions, type ScoreRequest, type ScoreCheckpoint } from '../../../core/src/calc/scorePlan'
import { scoreSearchSteps } from '../../../core/src/calc/scoreSearch'

// 显式启用性能测试，避免普通单测默认增加约 90 秒执行时间。
describe.runIf(process.env.SCORE_BENCHMARK === '1')('requested canyon score-plan performance scenario', () => {
  it('measures medium and high precision with four level-70 Salamence and level-50 Gardevoir', () => {
    const settings = { ...defaultSettings(), island: 'canyon' as const }
    settings.berries = [...islandById('canyon')!.berries]
    const box: ScoreRequest['box'] = Array.from({ length: 4 }, (_, i) => ({
      uid: `salamence-${i + 1}`, pokeId: 373, level: 70, nature: '勇敢',
      subskills: ['helpingBonus', 'berryS', 'helpM', 'skillM'],
      ingredientSlots: [0, 0, 0], skillLevel: 3, name: `暴飞龙 ${i + 1}`, napping: false,
    }))
    box.push({ uid: 'gardevoir', pokeId: 282, level: 50, nature: '自大',
      subskills: ['helpingBonus', 'skillM'], ingredientSlots: [0, 0, 0],
      skillLevel: 6, name: '沙奈朵', napping: false })
    const options = defaultScoreOptions(settings)
    const measurements: Record<string, unknown>[] = []
    for (let round = 1; round <= 3; round++) for (const precision of ['medium', 'high'] as const) {
      const request: ScoreRequest = { settings, box, options: { ...options, precision } }
      const before = performance.now()
      const steps = scoreSearchSteps(request)
      let maxStepMs = 0, checkpoints = 0, initialStepMs = 0, checkpoint: ScoreCheckpoint | undefined
      let next: ReturnType<typeof steps.next>
      do {
        const began = performance.now()
        next = steps.next()
        const duration = performance.now() - began
        maxStepMs = Math.max(maxStepMs, duration)
        if (!checkpoints) initialStepMs = duration
        if (!next.done) { checkpoint = next.value; checkpoints++ }
      } while (!next.done)
      const wallMs = performance.now() - before
      const result = next.value, best = result.solutions[0]!
      expect(result.excluded).toEqual([])
      expect(best.trace.members).toHaveLength(5)
      expect(best.trace.members.every(m => Math.abs(m.hours - 168) < 1e-6)).toBe(true)
      expect(best.mean).toBeGreaterThan(0)
      const row = { round, precision, wallMs: Math.round(wallMs), reportedMs: result.elapsedMs,
        initialStepMs: Math.round(initialStepMs), maxStepMs: Math.round(maxStepMs),
        compared: result.compared, simulations: result.simulations, reviewSamples: best.simulations,
        checkpoints, phase: checkpoint?.phase, mean: best.mean,
        berry: best.berry, cooking: best.cooking, deviation: best.deviation }
      measurements.push(row)
      console.log('SCORE_BENCHMARK', JSON.stringify(row))
    }
    writeFileSync(new URL('../../../docs/冲分规划-七岛-暴飞龙-耗时测试.json', import.meta.url),
      JSON.stringify({ date: '2026-10-12', runtime: process.version, platform: process.platform,
        cpu: cpus()[0]?.model, logicalCpus: cpus().length,
        note: 'Local Vitest synchronous algorithm benchmark; module transform and UI/Worker startup excluded. First medium run is cold, later runs reuse process/JIT. Fixed seed, Salamence skill 3, Gardevoir skill 6, AAA ingredients, pot 15, area bonus 0, no camp, no inventory.',
        settings, box, options, measurements }, null, 2))
  }, 300000)
})
