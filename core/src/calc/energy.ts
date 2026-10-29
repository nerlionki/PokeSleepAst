import ruleParameters from '../data/rule-parameters.resource'
import type { EnergyPoint, Settings, ProduceInput } from '../types'
import { MEAL_RECOVERY } from './data'
import { energyMultiplier } from './helpSpeed'
import { unlockedSubskills } from './member'
import { natureStatFactor } from './natureLabels'
const energy_recoveryFactor_ruleParameters = ruleParameters.modules.energy.recoveryFactor
const energy_sleepRecoveredEnergy_ruleParameters = ruleParameters.modules.energy.sleepRecoveredEnergy
const energy_energyCurve_ruleParameters = ruleParameters.modules.energy.energyCurve


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
  f *= 1 + energy_recoveryFactor_ruleParameters.energyRecoveryBonus * Math.min(energy_recoveryFactor_ruleParameters.maxRecoveryBonuses, Math.max(0, teamBonuses))
  if (incense) f *= energy_recoveryFactor_ruleParameters.incenseMultiplier
  return f
}

export function sleepRecoveredEnergy(energy: number, score: number, input: ProduceInput, incense: boolean, teamBonuses?: number): number {
  const cap = unlockedSubskills(input.level, input.subskills).includes('energyRecover') ? energy_sleepRecoveredEnergy_ruleParameters.recoveryBonusCap : energy_sleepRecoveredEnergy_ruleParameters.normalRecoveryCap
  return Math.max(energy, Math.min(cap, energy + score * recoveryFactor(input, incense, teamBonuses)))
}

export function energyCurve(settings: Settings, input: ProduceInput, days = 1): EnergyPoint[] {
  const start = parseHm(settings.sleepStart)
  const end = parseHm(settings.sleepEnd)
  const skillFactor = natureStatFactor(input.nature, 'energy')
  const skillPerTick = settings.dailySkillHeal / energy_energyCurve_ruleParameters.ticksPerDay
  const points: EnergyPoint[] = []
  let energy = Math.min(energy_energyCurve_ruleParameters.energyCap, Math.max(0, settings.sleepScore))
  const ticks = days * energy_energyCurve_ruleParameters.ticksPerDay

  for (let i = 0; i < ticks; i++) {
    const minute = (i * energy_energyCurve_ruleParameters.minutesPerTick) % 1440
    const asleep = inSleep(minute, start, end)
    const wasAsleep = i > 0 && inSleep((minute + energy_energyCurve_ruleParameters.previousTickOffset) % 1440, start, end)
    if (i > 0) energy = Math.max(0, energy - ruleParameters.modules.energy.energyDecay.perTick)
    if (wasAsleep && !asleep) energy = sleepRecoveredEnergy(energy, settings.sleepScore, input, settings.incense)
    if (!asleep) {
      energy = Math.min(energy_energyCurve_ruleParameters.energyCap, energy + skillPerTick * skillFactor)
    }
    if (settings.meals && !asleep && (minute === energy_energyCurve_ruleParameters.breakfastHour * 60 || minute === energy_energyCurve_ruleParameters.lunchHour * 60 || minute === energy_energyCurve_ruleParameters.dinnerHour * 60)) {
      energy = Math.min(energy_energyCurve_ruleParameters.energyCap, energy + mealRecover(energy))
    }
    points.push({
      minute: i * energy_energyCurve_ruleParameters.minutesPerTick,
      energy: Math.min(energy_energyCurve_ruleParameters.energyCap, Math.max(0, energy)),
      multiplier: energyMultiplier(energy),
      asleep,
    })
  }
  return points
}
