import type { BoxPokemon, EnergyPoint, ProduceInput, ProduceResult, Settings, TeamProduceResult } from '../types'
import { berryEnergyAt } from './berry'
import { pokeById } from './data'
import { cookMeals } from './cook'
import { mealRecover, recoveryFactor } from './energy'
import { energyMultiplier, instantInterval } from './helpSpeed'
import { slotDrop } from './ingredients'
import { effectiveSkillLevel, unlockedSubskills } from './member'
import { natureStatFactor } from './natureLabels'
import { ribbonBonus, stagesLeft } from './ribbon'
import { skillStorageLimit } from './specialty'
import { ACCEL_FACTOR, ACCEL_MINUTES, chargeStrength, skillKind, skillValue } from './skills'

export function teamHelpingBonus(roster: BoxPokemon[], fallback: number): number {
  const n = roster.filter((p) => unlockedSubskills(p.level, p.subskills).includes('helpingBonus')).length
  return n > 0 ? n : fallback
}

export function clockOf(minute: number): string {
  const m = ((minute % 1440) + 1440) % 1440
  const hh = String(Math.floor(m / 60)).padStart(2, '0')
  const mm = String(m % 60).padStart(2, '0')
  return `${hh}:${mm}`
}

function parseHm(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return (h % 24) * 60 + (m || 0)
}

function inSleep(minute: number, start: number, end: number): boolean {
  if (start === end) return false
  if (start < end) return minute >= start && minute < end
  return minute >= start || minute < end
}

export function carryLimit(base: number, subskills: string[], goodCamp: boolean, mode?: string, ribbonCarry = 0): number {
  if (mode === 'unlimited') return 9999
  if (mode === 'full') return 0
  let extra = ribbonCarry
  if (subskills.includes('invS')) extra += 6
  if (subskills.includes('invM')) extra += 12
  if (subskills.includes('invL')) extra += 18
  const camp = mode === 'normal' ? false : goodCamp
  return Math.round((base + extra) * (camp ? 1.2 : 1))
}

function berryCount(specialty: string, subskills: string[]): number {
  let n = specialty === '树果型' || specialty === '全部' ? 2 : 1
  if (subskills.includes('berryS')) n += 1
  return n
}

export interface SkillEvent {
  minute: number
  name: string
  kind: string
  actor: number
  note: string
}

export interface SimOpts {
  alwaysProc?: boolean
}

interface Member {
  input: ProduceInput
  poke: NonNullable<ReturnType<typeof pokeById>>
  energy: number
  next: number
  held: number
  stock: number
  accelUntil: number
  typeAccelUntil: number
  factor: number
  favored: boolean
  carry: number
  perHelp: number
  ingRate: number
  skillRate: number
  skillLv: number
  fill: number
  unitBerry: number
  result: ProduceResult
  curve: EnergyPoint[]
}

function roll(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

export function simulateTeam(
  settings: Settings,
  roster: ProduceInput[],
  helpingBonus: number,
  opts: SimOpts = {},
): { members: ProduceResult[], events: SkillEvent[] } {
  const days = settings.period === 'week' ? 7 : 1
  const endMin = days * 1440
  const sleepStart = parseHm(settings.sleepStart)
  const sleepEnd = parseHm(settings.sleepEnd)
  const events: SkillEvent[] = []

  const members: Member[] = []
  for (const input of roster) {
    const poke = pokeById(input.pokeId)
    if (!poke) continue
    const favored = settings.berries.includes(poke.berry)
    const subs = unlockedSubskills(input.level, input.subskills)
    const ribbon = ribbonBonus(input.ribbonHours ?? 0, stagesLeft(poke.id))
    const skillLv = effectiveSkillLevel(input.level, input.skillLevel, input.subskills, poke.mainSkill)
    members.push({
      input,
      poke,
      energy: Math.min(150, Math.max(0, input.wakeEnergy ?? settings.sleepScore)),
      next: 0,
      held: 0,
      stock: 0,
      accelUntil: -1,
      typeAccelUntil: -1,
      factor: recoveryFactor({ ...input, subskills: subs }, settings.incense),
      favored,
      carry: carryLimit(poke.carry, subs, settings.goodCamp, input.carryMode, ribbon.carry),
      perHelp: berryCount(poke.specialty, subs),
      ingRate: poke.ingredientRate * natureStatFactor(input.nature, 'ingredient')
        * (1 + (subs.includes('ingS') ? 0.18 : 0) + (subs.includes('ingM') ? 0.36 : 0)),
      skillRate: poke.skillRate * natureStatFactor(input.nature, 'skill')
        * (1 + (subs.includes('skillS') ? 0.18 : 0) + (subs.includes('skillM') ? 0.36 : 0)),
      skillLv,
      fill: chargeStrength(poke.mainSkill, skillLv),
      unitBerry: berryEnergyAt(poke.berry, input.level) * (favored ? 2 : 1) * (1 + settings.areaBonus),
      result: { helps: 0, berries: 0, berryEnergy: 0, ingredients: {}, skillProcs: 0, skillEnergy: 0, sneaky: 0, curve: [] },
      curve: [],
    })
  }

  const extraQueue: { minute: number, index: number }[] = []
  if (settings.whistleHelps) {
    for (let i = 0; i < members.length; i++) {
      for (let w = 0; w < settings.whistleHelps; w++) extraQueue.push({ minute: 1 + w, index: i })
    }
  }

  function asleepAt(min: number) {
    return inSleep(min % 1440, sleepStart, sleepEnd)
  }

  function intervalOf(m: Member, minute: number) {
    let accel = 1
    if (minute <= m.accelUntil || minute <= m.typeAccelUntil) accel *= ACCEL_FACTOR
    return instantInterval(
      m.poke.interval,
      m.input.level,
      m.input.nature,
      unlockedSubskills(m.input.level, m.input.subskills),
      helpingBonus,
      m.energy,
      settings.goodCamp,
      settings.island,
      m.favored,
      ribbonBonus(m.input.ribbonHours ?? 0, stagesLeft(m.poke.id)).speedCut,
    ) * accel
  }

  function triggerSkill(m: Member, minute: number) {
    m.stock -= 1
    m.result.skillProcs += 1
    const kind = skillKind(m.poke.mainSkill)
    const value = skillValue(m.poke.mainSkill, m.skillLv)
    if (kind === 'charge') m.result.skillEnergy += m.fill
    if (kind === 'healSelf') m.energy = Math.min(150, m.energy + value * m.factor)
    if (kind === 'healAll') {
      for (const other of members) other.energy = Math.min(150, other.energy + value * other.factor)
    }
    if (kind === 'healOne') {
      const target = members.slice().sort((a, b) => a.energy - b.energy)[0]
      if (target) target.energy = Math.min(150, target.energy + value * target.factor)
    }
    if (kind === 'helpAccel') {
      for (const other of members) other.accelUntil = minute + ACCEL_MINUTES
    }
    if (kind === 'typeAccel') {
      for (const other of members) {
        if (other.poke.berry === m.poke.berry) other.typeAccelUntil = minute + ACCEL_MINUTES
      }
    }
    if (kind === 'support') {
      const others = members.map((_, j) => j).filter((j) => members[j] !== m)
      const n = Math.max(1, value)
      for (let k = 0; k < n; k++) {
        const j = others.length ? others[k % others.length]! : 0
        extraQueue.push({ minute: minute + 1 + k, index: j })
      }
    }
    events.push({ minute, name: m.input.displayName || m.poke.name, kind, actor: m.input.pokeId, note: `${kind} +${value}` })
  }

  function applyHelp(m: Member, minute: number, seed: number, fromSupport = false) {
    m.result.helps += 1
    const full = m.held >= m.carry
    if (full) {
      m.result.berries += m.perHelp
      m.result.berryEnergy += m.perHelp * m.unitBerry
      m.result.sneaky += 1
    }
    else if (roll(seed) < m.ingRate && m.poke.ingredients.length) {
      const unlocked = m.input.level >= 60 ? 3 : m.input.level >= 30 ? 2 : 1
      const slot = Math.floor(roll(seed + 3) * unlocked)
      const lineIndex = m.input.ingredientSlots[slot]
      const drop = lineIndex == null ? null : slotDrop(m.poke.ingredients, slot, lineIndex)
      if (drop) {
        m.result.ingredients[drop.name] = (m.result.ingredients[drop.name] ?? 0) + drop.amount
        m.held += drop.amount
      }
      else {
        m.result.berries += m.perHelp
        m.result.berryEnergy += m.perHelp * m.unitBerry
        m.held += m.perHelp
      }
    }
    else {
      m.result.berries += m.perHelp
      m.result.berryEnergy += m.perHelp * m.unitBerry
      m.held += m.perHelp
    }
    if (opts.alwaysProc || roll(seed + 7) < m.skillRate) {
      m.stock = Math.min(skillStorageLimit(m.poke.specialty), m.stock + 1)
    }
    if (m.stock > 0 && !asleepAt(minute) && !fromSupport) triggerSkill(m, minute)
  }

  let t = 0
  let lastDecay = 0
  while (t < endMin) {
    const clock = t % 1440
    const asleep = asleepAt(t)
    if (!asleep && t - lastDecay >= 10) {
      for (const m of members) {
        m.energy = Math.max(0, m.energy - 1)
        if (settings.dailySkillHeal) {
          m.energy = Math.min(150, m.energy + (settings.dailySkillHeal / 144) * m.factor)
        }
      }
      lastDecay = t
    }
    if (settings.meals && !asleep && (clock === 4 * 60 || clock === 12 * 60 || clock === 18 * 60)) {
      for (const m of members) m.energy = Math.min(150, m.energy + mealRecover(m.energy) * m.factor)
    }
    if (asleep && clock === sleepEnd) {
      for (const m of members) m.energy = Math.min(100, m.energy + settings.sleepScore * m.factor)
    }
    if (t % 10 === 0) {
      for (const m of members) {
        m.curve.push({ minute: t, energy: m.energy, multiplier: energyMultiplier(m.energy), asleep })
      }
    }

    const due = extraQueue.filter((q) => q.minute <= t)
    for (const q of due) {
      const target = members[q.index]
      if (target) applyHelp(target, t, t + q.index * 17, true)
    }
    extraQueue.splice(0, extraQueue.length, ...extraQueue.filter((q) => q.minute > t))

    members.forEach((m, i) => {
      if (t >= m.next) {
        applyHelp(m, t, t + i * 31)
        m.next = t + intervalOf(m, t) / 60
      }
    })
    t += 1
  }

  for (const m of members) {
    if (m.stock > 0 && !asleepAt(endMin - 1)) triggerSkill(m, endMin - 1)
  }
  for (const q of extraQueue) {
    const target = members[q.index]
    if (target) applyHelp(target, Math.min(endMin - 1, q.minute), q.minute + q.index * 17, true)
  }
  for (const m of members) {
    const gathered = m.result.helps - m.result.sneaky
    if (m.input.carryMode !== 'full' && m.skillRate > 0 && m.result.skillProcs < 1 && gathered > 0) {
      m.result.skillProcs = 1
      m.result.skillEnergy += m.fill
    }
    m.result.curve = m.curve
  }
  return { members: members.map((m) => m.result), events }
}

export function teamTimeline(settings: Settings, roster: BoxPokemon[]) {
  const active = roster.filter((p) => !p.napping).slice(0, 5)
  const hb = teamHelpingBonus(active, settings.helpingBonus)
  const sim = simulateTeam(settings, active, hb)
  const bag: Record<string, number> = {}
  let berryEnergy = 0
  let skillEnergy = 0
  for (const m of sim.members) {
    berryEnergy += m.berryEnergy
    skillEnergy += m.skillEnergy
    for (const [k, v] of Object.entries(m.ingredients)) bag[k] = (bag[k] ?? 0) + v
  }
  const days = settings.period === 'week' ? 7 : 1
  const cooked: ReturnType<typeof cookMeals>['meals'] = []
  let cookEnergy = 0
  let remain = { ...bag }
  for (let d = 0; d < days; d++) {
    const sunday = settings.period === 'week' && d === 6
    const dailyShare: Record<string, number> = {}
    for (const [k, v] of Object.entries(remain)) dailyShare[k] = Math.floor(v / (days - d))
    const result = cookMeals(dailyShare, settings, 3, sunday)
    cooked.push(...result.meals)
    cookEnergy += result.meals.reduce((s, m) => s + m.energy, 0)
    for (const [k, v] of Object.entries(dailyShare)) remain[k] = (remain[k] ?? 0) - (v - (result.remain[k] ?? 0))
  }
  const out: TeamProduceResult = {
    members: sim.members,
    helpingBonus: hb,
    berryEnergy,
    skillEnergy,
    cookEnergy,
    totalEnergy: berryEnergy + skillEnergy + cookEnergy,
    bag,
    meals: cooked,
    events: sim.events,
  }
  return out
}
