import { describe, expect, it } from 'vitest'
import { simulateSleep, type SleepSimulationMessage, type SleepSimulationRequest } from '../../../core/src/calc/sleepSimulation'
import { sleepExpect } from './sleep'
const request: SleepSimulationRequest = { island: 'greengrass', sleepType: '淺淺入夢', powers: [1e7, 2e7], iterations: 250, seed: 9,
  options: { rank: '大师20', eventMix: true, discovered: [], undiscoveredBoost: false } }
describe('background sleep simulation', () => {
  it('preserves seeded split-session results and reports monotonic bounded progress', () => {
    const messages: SleepSimulationMessage[] = []
    simulateSleep(request, (message) => messages.push(message))
    const result = messages.at(-1)
    expect(result).toEqual({ type: 'result', result: request.powers.flatMap((power, index) => sleepExpect(request.island, request.sleepType, power,
      request.iterations, 'normal', { ...request.options, seed: request.seed + index })) })
    const updates = messages.filter((message) => message.type === 'progress')
    expect(updates.map((message) => message.completed)).toEqual([0, 100, 200, 250, 350, 450, 500])
    expect(updates.every((message) => message.total === 500)).toBe(true)
  })
  it('rejects invalid jobs without producing results', () => {
    const messages: SleepSimulationMessage[] = []
    simulateSleep({ ...request, powers: [NaN] }, (message) => messages.push(message))
    expect(messages).toEqual([{ type: 'error', message: '模拟参数无效，请重新设置' }])
  })
})
