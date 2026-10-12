import { describe, expect, it } from 'vitest'
import { beginTask, nextTask } from './nativeCalculation'
import { sleepExpect } from './sleep'
describe('headless native calculation entry', () => {
  it('computes seeded sleep research and replaces a completed task safely', () => {
    const request = { island: 'cyan' as const, sleepType: '深深入眠' as const, powers: [10000], iterations: 100, seed: 3, options: {} }
    beginTask('sleep', request)
    expect(JSON.parse(nextTask())).toMatchObject({ type: 'progress', completed: 100, total: 100 })
    let message = JSON.parse(nextTask()); while (message.type === 'progress') message = JSON.parse(nextTask())
    expect(message).toEqual({ type: 'result', result: sleepExpect('cyan', '深深入眠', 10000, 100, 'normal', { seed: 3 }) })
    beginTask('sleep', { ...request, powers: [NaN] })
    expect(JSON.parse(nextTask()).type).toBe('error')
  })
})
