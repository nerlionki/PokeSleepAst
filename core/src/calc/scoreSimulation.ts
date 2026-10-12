import type { BoxPokemon, ProduceInput } from '../types'
import { INGREDIENTS, RECIPES, pokeById } from './data'
import { berryUnitEnergy } from './berry'
import { mealRecover, sleepRecoveredEnergy } from './energy'
import { instantInterval } from './helpSpeed'
import { exEffects } from './exEffects'
import { slotDrop } from './ingredients'
import { resolveMemberSkill } from './mew'
import { effectiveSkillLevel, unlockedSubskills } from './member'
import { skillMaxFor } from './mainSkills'
import { natureStatFactor } from './natureLabels'
import { ribbonBonus, stagesLeft } from './ribbon'
import { carryLimit, teamHelpingBonus } from './timeline'
import { skillStorageLimit } from './specialty'
import { recipeLevelMult, recipeLevelOf } from './cook'
import { teamRestrictionError } from './teamRestrictions'
import { scoreSkill, type ScoreActor } from './scoreSkills'
import { hm, scoreBounds, scoreCandidates, scoreSleeps, seededRandom, validateScoreOptions,
  type ScoreAction, type ScorePolicy, type ScoreRequest, type ScoreSegment, type ScoreTrace, type SleepSession } from './scorePlan'

interface Actor extends ScoreActor {
  pokemon: BoxPokemon, input: ProduceInput, poke: NonNullable<ReturnType<typeof pokeById>>
  subs: string[], carry: number, drops: { name: string, amount: number }[], ingredientRate: number, berryCount: number
  unit: number, next: number, decay: number, heldBerries: number, heldFood: Record<string, number>, stock: number
  failures: number, syncHelps: number, pity: number, hours: number, dailyHours: number[], exp: number
}
export const SCORE_ASSUMPTIONS = [
  '近似搜索，未穷举整个 Box；操作表是一条固定种子的执行示例，统计收益来自多次模拟。',
  '技能保底：树果／食材型采用 78 次，技能型采用基准间隔推算；全能型暂按技能型模型，换队回退采用 1／3／10 次复核。',
  '树果汁获取率暂沿用共享模型 18.5%；使用限制为活力低于 100、只对当前上场成员使用，恢复 20 并仅应用正向性格修正。',
  '随机恢复目标沿用共享资料的验证概率并近似抽选；画皮资格在对应睡眠研究时为该段生产成员恢复。',
  '未上场个体暂停活力衰减；睡眠结算时未参加生产且未结算的 Box 成员按睡眠分数 5% 恢复。',
]
const sumBag = (bag: Record<string, number>) => Object.values(bag).reduce((a, b) => a + b, 0)
const add = (bag: Record<string, number>, name: string, amount: number) => { bag[name] = (bag[name] ?? 0) + amount }
const foodEnergy = (name: string) => INGREDIENTS.find(i => i.name === name)?.energy ?? 0

/** 始终按事件顺序推进，成员状态以 UID 保存。结束边界不领取携带物。 */
export function simulateScore(request: ScoreRequest, policy: ScorePolicy, seed: number, rollback = 1, record = true): ScoreTrace {
  const { options: o, settings } = request
  const invalid = validateScoreOptions(o, settings)
  if (invalid) throw new Error(invalid)
  const { start, end } = scoreBounds(o)
  const random = seededRandom(seed)
  const candidates = scoreCandidates(request.box).candidates
  const actors = new Map<string, Actor>()
  for (const pokemon of candidates) {
    const poke = pokeById(pokemon.pokeId)!
    const selected = resolveMemberSkill(poke, pokemon)
    const subs = unlockedSubskills(pokemon.level, pokemon.subskills)
    const ex = exEffects(settings, poke.berry, poke.specialty)
    const ribbon = ribbonBonus(pokemon.tune?.ribbonHours ?? 0, stagesLeft(poke.id))
    const input: ProduceInput = { ...pokemon, ribbonHours: pokemon.tune?.ribbonHours ?? 0 }
    const drops = pokemon.ingredientSlots.slice(0, pokemon.level >= 60 ? 3 : pokemon.level >= 30 ? 2 : 1)
      .map((index, slot) => index == null ? null : slotDrop(poke.ingredients, slot, index)).filter((drop): drop is NonNullable<typeof drop> => Boolean(drop))
    actors.set(pokemon.uid, { uid: pokemon.uid, pokemon, input, poke, subs, pokeId: poke.id, berry: poke.berry, skill: selected.name,
      skillLevel: Math.min(skillMaxFor(selected.name), effectiveSkillLevel(pokemon.level, pokemon.skillLevel, pokemon.subskills, selected.name) + ex.skillLevels),
      rate: Math.min(1, selected.rate * natureStatFactor(pokemon.nature, 'skill') * (1 + (subs.includes('skillS') ? 0.18 : 0) + (subs.includes('skillM') ? 0.36 : 0)) * ex.skillMultiplier),
      energy: 100, factor: natureStatFactor(pokemon.nature, 'energy'), disguise: o.initialDisguise[pokemon.uid] ?? true, stockpile: 0,
      firstFood: drops[0]?.name ?? '', drops, ingredientRate: Math.min(1, poke.ingredientRate * natureStatFactor(pokemon.nature, 'ingredient') * (1 + (subs.includes('ingS') ? 0.18 : 0) + (subs.includes('ingM') ? 0.36 : 0))),
      carry: carryLimit(poke.carry, subs, settings.goodCamp, 'preset', ribbon.carry, ex.carryExtra), berryCount: (['树果型', '全部'].includes(poke.specialty) ? 2 : 1) + Number(subs.includes('berryS')),
      unit: berryUnitEnergy(poke.berry, pokemon.level, settings.areaBonus, ex.berryMultiplier), next: Infinity, decay: start,
      heldBerries: 0, heldFood: {}, stock: 0, failures: 0, syncHelps: 0,
      pity: ['技能型', '全部'].includes(poke.specialty) ? Math.ceil(144000 / poke.interval) : 78,
      hours: 0, dailyHours: Array(7).fill(0), exp: 0 })
  }
  const warnings = new Set<string>()
  const actions: ScoreAction[] = []
  const segments: ScoreSegment[] = []
  const bag = { ...o.bag }, received: Record<string, number> = {}, consumed: Record<string, number> = {}, sold: Record<string, number> = {}
  const juice = { initial: o.initialJuice, received: 0, used: 0, lost: 0, remain: o.initialJuice }
  let berry = 0, zoneEnergy = 0, skill = 0, cooking = 0, zone = o.initialZone / 100, extraPot = o.initialPot, crit = o.initialCrit / 100
  let active: Actor[] = [], currentKey = '', lastRotation = start, currentMinute = start, depth = 0
  const sessions = scoreSleeps(o, settings)
  const settled = new Set<SleepSession>()
  const dayScores = new Map<number, number>()
  const recipePool = RECIPES.filter(r => r.category === o.category && !r.mix)
  const targetRecipe = recipePool.find(r => r.name === policy.recipe)
  const note = (action: ScoreAction) => { if (record) actions.push(action) }
  const select = (uids: string[]) => {
    if (uids.length > 5 || new Set(uids).size !== uids.length) throw new Error('规划队伍存在重复个体或超过 5 只')
    const members = uids.map(uid => actors.get(uid))
    if (members.some(m => !m)) throw new Error('规划队伍包含无效个体')
    const valid = members as Actor[]
    const error = teamRestrictionError(valid.map(m => m.pokemon))
    if (error) throw new Error(error)
    return valid
  }
  const interval = (m: Actor) => instantInterval(m.poke.interval, m.pokemon.level, m.pokemon.nature, m.subs,
    teamHelpingBonus(active.map(a => a.pokemon), settings.helpingBonus), m.energy, settings.goodCamp, settings.island,
    settings.berries.includes(m.berry), ribbonBonus(m.input.ribbonHours ?? 0, stagesLeft(m.pokeId)).speedCut,
    exEffects(settings, m.berry, m.poke.specialty).speed) / 60
  const creditBerries = (m: Actor, count: number) => {
    const base = count * m.unit
    berry += base
    if (m.poke.berryType === '超能') zoneEnergy += base * zone
  }
  const reserve = (name: string) => (targetRecipe?.ingredients.find(i => i.name === name)?.count ?? 0) * policy.reserveMeals
  function sellFor(amount: number) {
    let shortage = Math.max(0, sumBag(bag) + amount - 800)
    const sales: Record<string, number> = {}
    const names = Object.keys(bag).sort((a, b) => (reserve(a) > 0 ? 1 : 0) - (reserve(b) > 0 ? 1 : 0) || foodEnergy(a) - foodEnergy(b))
    for (const name of names) {
      const count = Math.min(shortage, bag[name] ?? 0)
      if (!count) continue
      bag[name]! -= count; shortage -= count; add(sold, name, count); add(sales, name, count)
      if (!shortage) break
    }
    if (sumBag(sales)) note({ minute: currentMinute, kind: 'sell', text: `卖出 ${sumBag(sales)} 个食材腾出空间`, foods: sales })
  }
  function creditFood(name: string, amount: number) {
    amount = Math.max(0, Math.floor(amount))
    if (!amount) return
    // 调用仅发生在可操作节点；先卖出，再接收，单批大于上限时分批处理。
    for (let left = amount; left > 0;) {
      const part = Math.min(800, left); sellFor(part); add(bag, name, part); add(received, name, part); left -= part
    }
  }
  function help(m: Actor, extra = false) {
    const full = m.heldBerries + sumBag(m.heldFood) >= m.carry
    if (!extra && full) { creditBerries(m, m.berryCount); return }
    if (m.drops.length && random() < m.ingredientRate) {
      const drop = m.drops[Math.floor(random() * m.drops.length)]!
      const ex = exEffects(settings, m.berry, m.poke.specialty)
      const bonus = !extra && ex.ingredientExtra ? 1 + Number(ex.ingredientExtra > 1 && random() < 0.5) : 0
      const count = extra ? drop.amount : Math.min(drop.amount + bonus, Math.max(0, m.carry - m.heldBerries - sumBag(m.heldFood)))
      if (extra) creditFood(drop.name, count); else add(m.heldFood, drop.name, count)
    } else if (extra) creditBerries(m, m.berryCount)
    else m.heldBerries += m.berryCount
    if (!extra && !full && m.stock < skillStorageLimit(m.poke.specialty)) {
      m.syncHelps++
      if (m.failures + m.syncHelps >= m.pity || random() < m.rate) { m.stock++; m.failures = 0; m.syncHelps = 0 }
    }
  }
  function release(m: Actor) {
    if (depth > 8) { warnings.add('技能连锁截断'); return }
    depth++
    const previous = new Map(active.map(a => [a.uid, a.energy]))
    note({ minute: currentMinute, kind: 'skill', text: `${m.pokemon.name || m.poke.name}发动${m.skill}`, members: [m.uid] })
    scoreSkill(m, active, {
      random,
      heal: (target, amount) => { const a = target as Actor; a.energy = Math.min(150, a.energy + amount); a.decay = currentMinute },
      charge: amount => { skill += amount * (1 + settings.areaBonus) },
      berries: (target, amount) => creditBerries(target as Actor, amount), ingredient: creditFood,
      helps: (target, count, only) => {
        const a = target as Actor
        if (only) { for (let i = 0; i < count; i++) if (random() < a.rate) { release(a); break } }
        else for (let i = 0; i < count; i++) help(a, true)
      },
      pot: amount => { extraPot = Math.min(200, extraPot + amount) }, crit: amount => { crit = Math.min(0.7, crit + amount) },
      zone: amount => { zone = Math.min(0.24, zone + amount) },
      juice: () => { if (juice.remain < 5) { juice.remain++; juice.received++ } else juice.lost++ },
      warning: text => warnings.add(text),
    })
    const changed = active.filter(a => Math.abs(a.energy - previous.get(a.uid)!) > 0.01)
    if (changed.length) note({ minute: currentMinute, kind: 'energy', text: `活力：${changed.map(a => `${a.pokemon.name || a.poke.name} ${previous.get(a.uid)!.toFixed(1)}→${a.energy.toFixed(1)}`).join('；')}`, members: changed.map(a => a.uid) })
    depth--
  }
  function collect() {
    const food: Record<string, number> = {}
    let fruits = 0
    for (const m of active) {
      fruits += m.heldBerries; creditBerries(m, m.heldBerries); m.heldBerries = 0
      for (const [name, count] of Object.entries(m.heldFood)) { add(food, name, count); creditFood(name, count) }
      m.heldFood = {}
      m.failures = Math.min(m.pity - 1, m.failures + m.syncHelps); m.syncHelps = 0
    }
    note({ minute: currentMinute, kind: 'collect', text: `收取树果 ${fruits} 颗、食材 ${sumBag(food)} 个`, members: active.map(m => m.uid), foods: food })
    for (const m of active) { const stock = m.stock; m.stock = 0; for (let i = 0; i < stock; i++) release(m) }
  }
  function rotate(team: Actor[], purpose: string) {
    const key = team.map(m => m.uid).join('/')
    if (key === currentKey) return
    if (active.length) {
      segments[segments.length - 1]!.end = currentMinute
      // 任意生产成员变化都会取消全队存储；FC 默认回退，保持 UID 状态。
      for (const m of new Set([...active, ...team])) { m.stock = 0; m.failures = Math.max(0, m.failures + m.syncHelps - rollback); m.syncHelps = 0 }
    }
    for (const m of team) if (!active.includes(m)) { m.next = currentMinute; m.decay = currentMinute }
    active = team; currentKey = key
    for (const m of active) if (m.next <= currentMinute) m.next = currentMinute + interval(m)
    segments.push({ start: currentMinute, end, members: team.map(m => m.uid), purpose })
    note({ minute: currentMinute, kind: 'team', text: `上场：${purpose}`, members: team.map(m => m.uid) })
  }
  function daytime() {
    if (policy.day.length === 1) return select(policy.day[0]!)
    const stocked = !targetRecipe || targetRecipe.ingredients.every(i => (bag[i.name] ?? 0) >= i.count * Math.max(1, policy.reserveMeals))
    return select(policy.day[stocked ? 0 : 1]!)
  }
  function settle(session: SleepSession, afterEnd = false) {
    if (settled.has(session)) return
    settled.add(session)
    const score = Math.max(0, Math.min(session.score, 100 - (dayScores.get(session.day) ?? 0)))
    dayScores.set(session.day, (dayScores.get(session.day) ?? 0) + score)
    const team = select(o.device ? policy.settle[session.slot]! : policy.sleep[session.slot]!)
    const bonuses = team.filter(m => m.subs.includes('energyRecover')).length
    const expBonus = 1 + team.filter(m => m.subs.includes('sleepExp')).length * 0.14
    for (const m of team) {
      m.energy = sleepRecoveredEnergy(m.energy, score, m.input, settings.incense, bonuses)
      m.decay = currentMinute
      m.exp += score * expBonus * natureStatFactor(m.pokemon.nature, 'exp')
    }
    const sleepTeam = select(policy.sleep[session.slot]!)
    for (const m of sleepTeam) m.disguise = true
    for (const m of actors.values()) if (!team.includes(m) && !sleepTeam.includes(m) && !active.includes(m)) {
      m.energy = sleepRecoveredEnergy(m.energy, Math.ceil(score * 0.05), m.input, settings.incense, 0)
    }
    note({ minute: session.settle, kind: 'settle', text: `${afterEnd ? '周期外' : ''}睡眠研究结算 ${score} 分；经验与活力分配给结算队`, members: team.map(m => m.uid) })
  }
  function cook() {
    const sunday = Math.floor((currentMinute - 240) / 1440) === 6
    const pot = Math.ceil((settings.potSize * (sunday ? 2 : 1) + extraPot) * (settings.goodCamp ? 1.5 : 1))
    const can = (r: typeof RECIPES[number]) => r.pot <= pot && r.ingredients.every(i => (bag[i.name] ?? 0) >= i.count)
    const ranked = recipePool.filter(can).sort((a, b) => b.baseEnergy * recipeLevelMult(recipeLevelOf(settings, b.name)) - a.baseEnergy * recipeLevelMult(recipeLevelOf(settings, a.name)))
    const chosen = targetRecipe && can(targetRecipe) ? targetRecipe : ranked[0]
    const remainingMeals = Math.floor((end - currentMinute) / 1440) * 3 + o.meals.filter(m => hm(m) > currentMinute % 1440).length
    // 搜索保留策略：还有餐次时，可跳过低价值餐以等待目标食谱。
    if ((!chosen || targetRecipe && chosen.name !== targetRecipe.name && policy.reserveMeals > 0) && remainingMeals > 0) {
      note({ minute: currentMinute, kind: 'skip', text: `跳餐：为${policy.recipe || '后续料理'}保留食材、扩锅 ${extraPot} 与技能暴击 ${(crit * 100).toFixed(0)}%` }); return
    }
    if (!sumBag(bag)) { note({ minute: currentMinute, kind: 'skip', text: '跳餐：没有可用食材' }); return }
    const foods: Record<string, number> = {}
    let used = 0, raw = 0
    if (chosen) {
      raw = chosen.baseEnergy * recipeLevelMult(recipeLevelOf(settings, chosen.name))
      for (const i of chosen.ingredients) { bag[i.name]! -= i.count; add(foods, i.name, i.count); used += i.count }
    }
    const names = Object.keys(bag).sort((a, b) => foodEnergy(b) - foodEnergy(a))
    for (const name of names) {
      const keep = remainingMeals > 0 && policy.reserveMeals > 0 ? reserve(name) : 0
      const count = Math.min(pot - used, Math.max(0, (bag[name] ?? 0) - keep))
      if (!count || chosen && !policy.fill) continue
      bag[name]! -= count; used += count; raw += count * foodEnergy(name); add(foods, name, count)
    }
    if (!used) { note({ minute: currentMinute, kind: 'skip', text: '跳餐：保留下一餐所需食材' }); return }
    const chance = Math.min(1, (sunday ? 0.3 : 0.1) + crit)
    const hit = chance >= 1 || random() < chance
    const energy = Math.round(raw * (1 + settings.areaBonus) * (hit ? sunday ? 3 : 2 : 1))
    cooking += energy; extraPot = 0; if (hit) crit = 0
    for (const [name, amount] of Object.entries(foods)) add(consumed, name, amount)
    for (const m of active) { m.energy = Math.min(150, m.energy + mealRecover(m.energy)); m.decay = currentMinute }
    note({ minute: currentMinute, kind: 'cook', text: `${chosen?.name ?? '拌拌料理'}${chosen ? ` Lv.${recipeLevelOf(settings, chosen.name)}` : ''} · ${used}/${pot} 个食材 · 暴击率 ${(chance * 100).toFixed(0)}%${hit ? ' · 暴击' : ''}`, foods, energy })
  }
  const initialSleep = sessions.find(s => start >= s.start && start < s.end)
  rotate(initialSleep ? select(policy.sleep[initialSleep.slot]!) : daytime(), initialSleep ? `睡眠生产队 ${initialSleep.slot + 1}` : '白天生产队')
  for (let t = start; t < end; t++) {
    currentMinute = t
    const sleep = sessions.find(s => t >= s.start && t < s.end)
    const entering = sessions.find(s => s.start === t)
    const waking = sessions.find(s => s.end === t)
    const canCollect = !sleep || sleep.collect
    // 同刻顺序：衰减、研究、完成帮忙、收菜/技能、换队、道具、料理。
    for (const m of active) {
      if (t - m.decay >= 10) { m.energy = Math.max(0, m.energy - 1); m.decay = t }
      m.hours += 1 / 60
      const d = Math.floor((t - 240) / 1440); if (d >= 0 && d < 7) m.dailyHours[d]! += 1 / 60
    }
    for (const s of sessions) if (s.settle === t && t > start) settle(s)
    for (const m of active) while (m.next <= t && m.next < end) {
      help(m); m.next += interval(m)
    }
    const collection = t > start && (Boolean(waking) || Boolean(entering) || canCollect && (sleep ? (t - sleep.start) % o.sleeps[sleep.slot]!.collectMinutes === 0 : (t - start) % o.collectMinutes === 0))
    if (collection) collect()
    const chosen = sleep ? select(policy.sleep[sleep.slot]!) : daytime()
    if (!active.length || entering || waking || !sleep && collection && t - lastRotation >= policy.rotateMinutes) {
      rotate(chosen, sleep ? `睡眠生产队 ${sleep.slot + 1}` : '白天生产队'); lastRotation = t
    }
    if (o.useJuice && (collection || t === start && !sleep) && juice.remain > 0) {
      const target = [...active].filter(m => m.energy < Math.min(100, policy.juiceAt)).sort((a, b) => a.energy - b.energy)[0]
      if (target) {
        const recovered = 20 * Math.max(1, target.factor)
        target.energy = Math.min(123, target.energy + recovered); target.decay = t; juice.remain--; juice.used++
        note({ minute: t, kind: 'juice', text: `树果汁：${target.pokemon.name || target.poke.name}恢复 ${recovered} 活力`, members: [target.uid] })
      }
    }
    if (canCollect && o.meals.some(m => hm(m) === t % 1440)) cook()
  }
  // 分钟边界之后、结束之前完成的帮忙仍计生产；不产生末尾领取事件。
  for (const m of active) while (m.next < end) { currentMinute = m.next; help(m); m.next += interval(m) }
  // 最后一段睡眠允许延迟结算；仅恢复与经验，没有结束后的帮忙/收菜/技能/料理。
  for (const s of sessions) if (s.settle >= end && s.start >= start && s.start < end) { currentMinute = s.settle; settle(s, true) }
  if (segments.length) segments[segments.length - 1]!.end = end
  const members = [...actors.values()].filter(m => m.hours || m.exp).map(m => ({ uid: m.uid, hours: m.hours, dailyHours: m.dailyHours,
    energy: m.energy, exp: m.exp, heldBerries: m.heldBerries, heldFood: m.heldFood, stock: m.stock }))
  const total = berry + zoneEnergy + skill + cooking
  return { berry, zone: zoneEnergy, skill, cooking, total, bag, received, consumed, sold, juice, members, actions, segments, warnings: [...warnings] }
}
