import type { EnergyPoint, Settings, ProduceInput } from '../types'
import { MEAL_RECOVERY } from './data'
import { energyMultiplier } from './helpSpeed'
import { natureStatFactor } from './natureLabels'

function parseHm(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return (h % 24) * 60 + (m || 0)
}

function inSleep(minute: number, start: number, end: number): boolean {
  if (start === end) return false
  if (start < end) return minute >= start && minute < end
  return minute >= start || minute < end
}

export function mealRecover(energy: number): number {
  const row = MEAL_RECOVERY.find((r) => energy >= r.min && energy <= r.max)
  return row?.recover ?? 0
}

export function recoveryFactor(input: ProduceInput, incense: boolean): number {
  let f = natureStatFactor(input.nature, 'energy')
  if (input.subskills.includes('energyRecover')) f *= 1.14
  if (incense) f *= 2
  return f
}

export function energyCurve(settings: Settings, input: ProduceInput, days = 1): EnergyPoint[] {
  const start = parseHm(settings.sleepStart)
  const end = parseHm(settings.sleepEnd)
  const factor = recoveryFactor(input, settings.incense)
  const skillPerTick = settings.dailySkillHeal / 144
  const points: EnergyPoint[] = []
  let energy = Math.min(150, Math.max(0, settings.sleepScore))
  const ticks = days * 144

  for (let i = 0; i < ticks; i++) {
    const minute = (i * 10) % 1440
    const asleep = inSleep(minute, start, end)
    if (!asleep) {
      energy = Math.max(0, energy - 1)
      energy = Math.min(150, energy + skillPerTick * factor)
    }
    if (settings.meals && !asleep && (minute === 4 * 60 || minute === 12 * 60 || minute === 18 * 60)) {
      energy = Math.min(150, energy + mealRecover(energy) * factor)
    }
    if (asleep && minute === end) {
      energy = Math.min(100, energy + settings.sleepScore * factor)
    }
    points.push({
      minute: i * 10,
      energy: Math.min(150, Math.max(0, energy)),
      multiplier: energyMultiplier(energy),
      asleep,
    })
  }
  return points
}
