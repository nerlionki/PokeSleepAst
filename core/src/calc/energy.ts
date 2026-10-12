import type { EnergyPoint, Settings, ProduceInput } from '../types'
import { MEAL_RECOVERY } from './data'
import { energyMultiplier } from './helpSpeed'
import { unlockedSubskills } from './member'
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
  const row = MEAL_RECOVERY.find((r) => energy >= r.min && energy < r.max)
  return row?.recover ?? 0
}

/** 仅睡眠回活：全队回复奖励按层数相加，回复熏香不影响料理或技能。 */
export function recoveryFactor(input: ProduceInput, incense: boolean, teamBonuses = Number(unlockedSubskills(input.level, input.subskills).includes('energyRecover'))): number {
  let f = natureStatFactor(input.nature, 'energy')
  f *= 1 + 0.14 * Math.min(5, Math.max(0, teamBonuses))
  if (incense) f *= 2
  return f
}

export function sleepRecoveredEnergy(energy: number, score: number, input: ProduceInput, incense: boolean, teamBonuses?: number): number {
  const cap = unlockedSubskills(input.level, input.subskills).includes('energyRecover') ? 105 : 100
  return Math.max(energy, Math.min(cap, energy + score * recoveryFactor(input, incense, teamBonuses)))
}

export function energyCurve(settings: Settings, input: ProduceInput, days = 1): EnergyPoint[] {
  const start = parseHm(settings.sleepStart)
  const end = parseHm(settings.sleepEnd)
  const skillFactor = natureStatFactor(input.nature, 'energy')
  const skillPerTick = settings.dailySkillHeal / 144
  const points: EnergyPoint[] = []
  let energy = Math.min(150, Math.max(0, settings.sleepScore))
  const ticks = days * 144

  for (let i = 0; i < ticks; i++) {
    const minute = (i * 10) % 1440
    const asleep = inSleep(minute, start, end)
    const wasAsleep = i > 0 && inSleep((minute + 1430) % 1440, start, end)
    if (i > 0) energy = Math.max(0, energy - 1)
    if (wasAsleep && !asleep) energy = sleepRecoveredEnergy(energy, settings.sleepScore, input, settings.incense)
    if (!asleep) {
      energy = Math.min(150, energy + skillPerTick * skillFactor)
    }
    if (settings.meals && !asleep && (minute === 8 * 60 || minute === 12 * 60 || minute === 18 * 60)) {
      energy = Math.min(150, energy + mealRecover(energy))
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
