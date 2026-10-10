import { applyMainSkill, type EffectActor } from './skillEffects'
import { CookingSkillState } from './cookingSkillState'
import { resolveMemberSkill } from './mew'
import type { BoxPokemon, EnergyPoint, ProduceInput, ProduceResult, Settings, TeamProduceResult } from '../types'
import { exEffects } from './exEffects'
import { skillMaxFor } from './mainSkills'
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
  return Math.min(5, n + Math.max(0, Math.floor(Number(fallback) || 0)))
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
  excludeSkillFoodFromCooking?: boolean
  /** 个体对比固定活力，不使用回复或衰减改变生产速度。 */
  fixedEnergy?: number
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
): { members: ProduceResult[], events: SkillEvent[], meals: ReturnType<typeof cookMeals>['meals'], bag: Record<string, number>, remain: Record<string, number> } {
  const days = settings.period === 'week' ? 7 : 1
  const endMin = days * 1440
  const sleepStart = parseHm(settings.sleepStart)
  const sleepEnd = parseHm(settings.sleepEnd)
  const events: SkillEvent[] = []
  const meals: ReturnType<typeof cookMeals>['meals'] = []
  const cooking = new CookingSkillState()
  const bag: Record<string, number> = {}
  const produced: Record<string, number> = {}
  const heldFood = new Map<Member, Record<string, number>>()
  function creditFood(actor: EffectActor, name: string, amount: number, fromSkill = false) {
    actor.result.ingredients[name] = (actor.result.ingredients[name] ?? 0) + amount
    if (fromSkill) {
      actor.result.skillIngredients ??= {}
      actor.result.skillIngredients[name] = (actor.result.skillIngredients[name] ?? 0) + amount
    }
    if (!fromSkill || !opts.excludeSkillFoodFromCooking) bag[name] = (bag[name] ?? 0) + amount
    produced[name] = (produced[name] ?? 0) + amount
  }
  function creditSkillFood(actor: EffectActor, name: string, amount: number) { creditFood(actor, name, amount, true) }

  const members: Member[] = []
  for (const input of roster) {
    const species = pokeById(input.pokeId)
    const selected = species ? resolveMemberSkill(species, input) : null
    const poke = species && selected ? { ...species, mainSkill: selected.name, skillRate: selected.rate } : undefined
    if (!poke) continue
    const favored = settings.berries.includes(poke.berry)
    const ex = exEffects(settings, poke.berry, poke.specialty)
    const subs = unlockedSubskills(input.level, input.subskills)
    const ribbon = ribbonBonus(input.ribbonHours ?? 0, stagesLeft(poke.id))
    const skillLv = Math.min(skillMaxFor(poke.mainSkill), effectiveSkillLevel(input.level, input.skillLevel, input.subskills, poke.mainSkill) + ex.skillLevels)
    members.push({
      input,
      poke,
      energy: Math.min(150, Math.max(0, opts.fixedEnergy ?? input.wakeEnergy ?? settings.sleepScore)),
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
        * (1 + (subs.includes('skillS') ? 0.18 : 0) + (subs.includes('skillM') ? 0.36 : 0)) * ex.skillMultiplier,
      skillLv,
      fill: chargeStrength(poke.mainSkill, skillLv),
      unitBerry: berryEnergyAt(poke.berry, input.level) * ex.berryMultiplier * (1 + settings.areaBonus),
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
      opts.fixedEnergy ?? m.energy,
      settings.goodCamp,
      settings.island,
      m.favored,
      ribbonBonus(m.input.ribbonHours ?? 0, stagesLeft(m.poke.id)).speedCut,
      exEffects(settings, m.poke.berry).speed,
    ) * accel
  }

  function expectedHelp(target: EffectActor, amount: number) {
    const m = target as Member
    const slots = m.input.ingredientSlots.slice(0, m.input.level >= 60 ? 3 : m.input.level >= 30 ? 2 : 1)
    const drops = slots.map((index, slot) => index == null ? null : slotDrop(m.poke.ingredients, slot, index))
    const foodRate = drops.length ? Math.min(1, m.ingRate) : 0
    let foodChance = 0
    for (const drop of drops) {
      if (!drop) continue
      const chance = foodRate / drops.length
      foodChance += chance
      creditSkillFood(m, drop.name, amount * chance * drop.amount)
    }
    const berries = amount * (1 - foodChance) * m.perHelp
    m.result.helps += amount
    m.result.berries += berries
    m.result.berryEnergy += berries * m.unitBerry
  }

  function dispatchSkill(m: Member, minute: number, weight = 1, depth = 0) {
    if (weight < 1e-8 || depth > 12) return
    m.result.skillProcs += weight
    if (m.input.pokeId === 151) {
      const ex = exEffects(settings, m.poke.berry, m.poke.specialty)
      const omniLv = Math.min(8, effectiveSkillLevel(m.input.level, m.input.skillLevel, m.input.subskills, '十项全能') + ex.skillLevels)
      m.result.rewards ??= { dreamShards: 0, candies: 0, berryJuice: 0 }
      m.result.rewards.candies += weight * (1 + Math.max(0, omniLv - 5) * 0.3)
    }
    const kind = skillKind(m.poke.mainSkill)
    const value = skillValue(m.poke.mainSkill, m.skillLv)
    const applied = applyMainSkill(m, members, {
      ingredient: creditSkillFood,
      help: expectedHelp,
      pot: amount => cooking.addPot(amount),
      crit: choices => cooking.addCrit(choices),
      charge: (actor, amount) => { actor.result.skillEnergy += amount * (1 + settings.areaBonus) },
      skillOnly: (target, helps, probability) => {
        // n 次仅技能帮忙至少触发一次的概率；不产生食材/树果。
        const chance = 1 - (1 - Math.min(1, target.skillRate)) ** helps
        dispatchSkill(target as Member, minute, chance * probability, depth + 1)
      },
    }, weight)
    if (!applied) {
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
    }
    if (depth === 0) events.push({ minute, name: m.input.displayName || m.poke.name, kind, actor: m.input.pokeId, note: `${kind} +${value}` })
  }

  function triggerSkill(m: Member, minute: number) {
    m.stock -= 1
    dispatchSkill(m, minute)
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
        const ex = exEffects(settings, m.poke.berry, m.poke.specialty)
        const extra = fromSupport ? 0 : ex.ingredientExtra > 0 ? 1 + (ex.ingredientExtra > 1 && roll(seed + 13) < 0.5 ? 1 : 0) : 0
        if (asleepAt(minute)) {
          const held = heldFood.get(m) ?? {}
          held[drop.name] = (held[drop.name] ?? 0) + drop.amount + extra
          heldFood.set(m, held)
        } else creditFood(m, drop.name, drop.amount + extra)
        m.held += drop.amount + extra
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
    if (!fromSupport && !full && (opts.alwaysProc || roll(seed + 7) < m.skillRate)) {
      m.stock = Math.min(skillStorageLimit(m.poke.specialty), m.stock + 1)
    }
    if (!asleepAt(minute) && !fromSupport) {
      const held = heldFood.get(m)
      if (held) { for (const [name, amount] of Object.entries(held)) creditFood(m, name, amount); heldFood.delete(m) }
      m.held = 0
      while (m.stock > 0) triggerSkill(m, minute)
    }
  }

  let t = 0
  let lastDecay = 0
  while (t < endMin) {
    const clock = t % 1440
    const asleep = asleepAt(t)
    if (opts.fixedEnergy == null && !asleep && t - lastDecay >= 10) {
      for (const m of members) {
        m.energy = Math.max(0, m.energy - 1)
        if (settings.dailySkillHeal) {
          m.energy = Math.min(150, m.energy + (settings.dailySkillHeal / 144) * m.factor)
        }
      }
      lastDecay = t
    }
    if (!asleep && clock === sleepEnd) {
      for (const m of members) {
        if (opts.fixedEnergy == null) m.energy = Math.min(100, m.energy + settings.sleepScore * m.factor)
        const held = heldFood.get(m)
        if (held) { for (const [name, amount] of Object.entries(held)) creditFood(m, name, amount); heldFood.delete(m) }
        m.held = 0
        while (m.stock > 0) triggerSkill(m, t)
      }
    }
    if (t % 10 === 0) {
      for (const m of members) {
        const energy = opts.fixedEnergy ?? m.energy
        m.curve.push({ minute: t, energy, multiplier: energyMultiplier(energy), asleep })
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
    if (settings.meals && !asleep && [480,720,1080].includes(clock) && meals.length < 21) {
      const sunday = settings.period === 'week' && Math.floor(t / 1440) === 6
      const pot = cooking.potSize(settings.potSize, sunday || settings.sundayPot, settings.goodCamp)
      if (Object.values(bag).some(amount => amount >= 1)) {
        const crit = cooking.cook(sunday)
        const cooked = cookMeals(bag, settings, 1, sunday, { pot, multiplier: crit.multiplier })
        meals.push({ ...cooked.meals[0]!, minute: t, critChance: crit.chance, potSize: pot })
        for (const name of Object.keys(bag)) bag[name] = cooked.remain[name] ?? 0
        for (const m of members) m.energy = Math.min(150, m.energy + mealRecover(m.energy) * m.factor)
      } else meals.push({ name: '无可用食材', mix: true, potUsed: 0, energy: 0, minute: t, potSize: pot, critChance: 0 })
    }
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
      dispatchSkill(m, endMin - 1, 1 - m.result.skillProcs)
    }
    m.result.curve = m.curve
  }
  return { members: members.map((m) => m.result), events, meals, bag: produced, remain: bag }
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
  const cooked = sim.meals
  const cookEnergy = cooked.reduce((sum, meal) => sum + meal.energy, 0)
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
