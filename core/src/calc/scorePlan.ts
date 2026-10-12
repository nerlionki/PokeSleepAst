import type { BoxPokemon, MealCategory, Settings } from '../types'
import { INGREDIENTS, NATURES, pokeById } from './data'
import { POKEMON_LEVEL_MAX } from './xp'
import { unlockedSubskills } from './member'
import { skillByPokedexName } from './mainSkills'
import { resolveMemberSkill } from './mew'

export const SCORE_RULE_VERSION = 2
export interface ScoreSleep {
  start: string
  end: string
  classification: 'auto' | 'day' | 'night'
  extreme: 'auto' | 'on' | 'off'
  collectMinutes: number
  settleDelay: number
}
export interface ScoreOptions {
  startDay: number
  startTime: string
  days: number
  initialStrength: number
  bag: Record<string, number>
  category: MealCategory
  meals: [string, string, string]
  collectMinutes: number
  precision: 'medium' | 'high'
  seed: number
  initialDisguise: Record<string, boolean>
  initialCrit: number
  initialPot: number
  initialZone: number
  initialJuice: number
  useJuice: boolean
  splitSleep: boolean
  device: boolean
  dayStart: string
  dayEnd: string
  sleeps: [ScoreSleep, ScoreSleep]
}
export function defaultScoreOptions(settings?: Settings): ScoreOptions {
  const sleep = (start: string, end: string): ScoreSleep => ({ start, end, classification: 'auto', extreme: 'auto', collectMinutes: 60, settleDelay: 0 })
  return { startDay: 0, startTime: '04:00', days: 7, initialStrength: 0, bag: {}, category: settings?.mealCategory ?? 'curry',
    meals: ['08:00', '12:00', '18:00'], collectMinutes: 60, precision: 'medium', seed: 20261012,
    initialDisguise: {}, initialCrit: 0, initialPot: 0, initialZone: 0, initialJuice: 0, useJuice: true,
    splitSleep: false, device: false, dayStart: '08:00', dayEnd: '22:00',
    sleeps: [sleep(settings?.sleepStart ?? '23:00', settings?.sleepEnd ?? '07:30'), sleep('13:00', '14:30')] }
}
export function normalizeScoreOptions(raw?: Partial<ScoreOptions> & { initialEnergy?: Record<string, number> }, settings?: Settings): ScoreOptions {
  const defaults = defaultScoreOptions(settings)
  // 清除旧存档的个体活力设置；随机种子仅作为内部复现参数，不再由界面配置。
  const saved = { ...raw }
  delete saved.initialEnergy
  return { ...defaults, ...saved, seed: defaults.seed, bag: { ...raw?.bag }, initialDisguise: { ...raw?.initialDisguise },
    meals: [...(raw?.meals ?? defaults.meals)] as ScoreOptions['meals'],
    sleeps: defaults.sleeps.map((s, i) => ({ ...s, ...raw?.sleeps?.[i] })) as ScoreOptions['sleeps'] }
}
export function hm(value: string): number {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return NaN
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3))
}
export function clockIn(minute: number, start: number, end: number): boolean {
  const m = ((minute % 1440) + 1440) % 1440
  return start < end ? m >= start && m < end : m >= start || m < end
}
export function scoreBounds(o: ScoreOptions) {
  const start = o.startDay * 1440 + hm(o.startTime)
  return { start, end: Math.min(start + o.days * 1440, 7 * 1440 + 240) }
}
export function extremeSleep(o: ScoreOptions, sleep: ScoreSleep): boolean {
  const day = sleep.classification === 'day' || sleep.classification === 'auto' && clockIn(hm(sleep.start), hm(o.dayStart), hm(o.dayEnd))
  return o.device && (sleep.extreme === 'on' || sleep.extreme === 'auto' && day) && sleep.collectMinutes > 0
}
export interface SleepSession { slot: number, start: number, end: number, settle: number, score: number, day: number, collect: boolean }
export function scoreSleeps(o: ScoreOptions, settings: Settings): SleepSession[] {
  const { start, end } = scoreBounds(o)
  const sessions: SleepSession[] = []
  for (let day = -1; day <= 7; day++) {
    for (const [slot, sleep] of o.sleeps.slice(0, o.splitSleep ? 2 : 1).entries()) {
      const a = day * 1440 + hm(sleep.start)
      const b = a + ((hm(sleep.end) - hm(sleep.start) + 1440) % 1440)
      if (a < end && b > start) sessions.push({ slot, start: a, end: b, settle: b + (o.device ? sleep.settleDelay : 0),
        score: o.splitSleep ? Math.min(100, Math.floor((b - a) / 5.1)) : settings.sleepScore,
        day: Math.floor((a - 240) / 1440), collect: extremeSleep(o, sleep) })
    }
  }
  return sessions.sort((a, b) => a.start - b.start)
}
export function validateScoreOptions(o: ScoreOptions, settings: Settings): string | null {
  const integer = (v: number, min: number, max: number) => Number.isSafeInteger(v) && v >= min && v <= max
  if (!integer(o.startDay, 0, 6) || !integer(o.days, 1, 7 - o.startDay)) return '规划天数不能超过本周剩余天数'
  if (!Number.isFinite(hm(o.startTime)) || o.startDay === 0 && hm(o.startTime) < 240) return '开始时刻须在本周一 04:00 之后'
  if (!integer(o.initialStrength, 0, Number.MAX_SAFE_INTEGER)) return '卡比兽初始能量须为非负整数'
  if (!['curry', 'salad', 'dessert'].includes(o.category) || !['medium', 'high'].includes(o.precision)) return '请选择料理类型和搜索精度'
  if (!integer(o.collectMinutes, 5, 240)) return '收菜间隔须为 5–240 分钟'
  if (!integer(o.seed, 1, 2147483647)) return '规划参数无效，请恢复默认设置'
  if (!Number.isFinite(o.initialCrit) || o.initialCrit < 0 || o.initialCrit > 70 || !integer(o.initialPot, 0, 200)
    || !Number.isFinite(o.initialZone) || o.initialZone < 0 || o.initialZone > 24 || !integer(o.initialJuice, 0, 5)) return '初始技能或道具加成超出允许范围'
  if (Object.entries(o.bag).some(([name, n]) => !INGREDIENTS.some(i => i.name === name) || !integer(n, 0, 800))
    || Object.values(o.bag).reduce((a, b) => a + b, 0) > 800) return '初始食材须为整数，合计不能超过 800'
  if (o.meals.length !== 3 || o.meals.some((m, i) => !Number.isFinite(hm(m)) || hm(m) < [360, 720, 1080][i]! || hm(m) >= [720, 1080, 1440][i]!)) return '做饭时间须分别位于早餐 06:00–11:59、午餐 12:00–17:59、晚餐 18:00–23:59'
  if (!Number.isFinite(hm(o.dayStart)) || !Number.isFinite(hm(o.dayEnd)) || o.dayStart === o.dayEnd) return '白天分类范围须为两个不同的有效时刻'
  for (const s of o.sleeps.slice(0, o.splitSleep ? 2 : 1)) {
    if (!Number.isFinite(hm(s.start)) || !Number.isFinite(hm(s.end)) || s.start === s.end) return '睡眠开始和结束须为不同的有效时刻'
    if (!integer(s.collectMinutes, 0, 240) || s.collectMinutes > 0 && s.collectMinutes < 5 || !integer(s.settleDelay, 0, 1440)) return '睡眠收菜间隔须为 0 或 5–240 分钟，结算延迟须为 0–1440 分钟'
    if (o.meals.some(m => clockIn(hm(m), hm(s.start), hm(s.end))) && !extremeSleep(o, s)) return '做饭时间与不收菜的睡眠冲突，请在详细设置调整餐次或睡眠时间'
  }
  const sleeps = scoreSleeps(o, settings)
  if (sleeps.some((s, i) => i > 0 && s.start < sleeps[i - 1]!.end)) return '两段睡眠不能重叠'
  if (!Number.isFinite(settings.areaBonus) || settings.areaBonus < 0 || settings.areaBonus > 0.85 || !integer(settings.potSize, 1, 1000)) return '请先检查岛屿加成和锅容量设置'
  return null
}
export function scoreCandidates(box: BoxPokemon[]) {
  const excluded: { uid: string, name: string, reason: string }[] = []
  const seen = new Set<string>()
  const candidates = box.filter(p => {
    const poke = pokeById(p.pokeId)
    const slots = p.level >= 60 ? 3 : p.level >= 30 ? 2 : 1
    let reason = ''
    if (!p.uid || seen.has(p.uid)) reason = '个体标识为空或重复'
    else if (p.napping) reason = '正在午睡岛，无法上场'
    else if (!poke || poke.interval <= 0) reason = '缺少生产资料'
    else if (!Number.isInteger(p.level) || p.level < 1 || p.level > POKEMON_LEVEL_MAX || !NATURES.some(n => n.name === p.nature)) reason = '等级或性格无效'
    else if (!Number.isInteger(p.skillLevel) || p.skillLevel < 1 || !skillByPokedexName(resolveMemberSkill(poke, p).name, p.pokeId)) reason = '主技能配置无效'
    else if (p.ocrMissing?.some(f => ['level', 'nature', 'skillLevel'].includes(f)
      || f.startsWith('ingredient') && Number(f.at(-1)) < slots
      || f.startsWith('subskill') && p.level >= [10, 25, 50, 70, 80][Number(f.at(-1))]!)) reason = '生产相关 OCR 字段尚未确认'
    else if (p.ingredientSlots.slice(0, slots).some((index, slot) => index == null ? poke.specialty !== '全部' || slot === 0
      : !Number.isInteger(index) || !poke.ingredients[index]?.amounts[slot])) reason = '已解锁食材配置无效'
    else if (new Set(unlockedSubskills(p.level, p.subskills)).size !== unlockedSubskills(p.level, p.subskills).length) reason = '已解锁副技能重复'
    seen.add(p.uid)
    if (reason) excluded.push({ uid: p.uid, name: p.name || poke?.name || String(p.pokeId), reason })
    return !reason
  })
  return { candidates, excluded }
}
export interface ScorePolicy {
  day: string[][]
  sleep: string[][]
  settle: string[][]
  recipe: string
  reserveMeals: number
  rotateMinutes: number
  fill: boolean
  juiceAt: number
}
export interface ScoreAction { minute: number, kind: string, text: string, members?: string[], foods?: Record<string, number>, energy?: number }
export interface ScoreSegment { start: number, end: number, members: string[], purpose: string }
export interface ScoreMemberResult { uid: string, hours: number, dailyHours: number[], energy: number, exp: number, heldBerries: number, heldFood: Record<string, number>, stock: number }
export interface ScoreTrace {
  berry: number, zone: number, skill: number, cooking: number, total: number
  bag: Record<string, number>, received: Record<string, number>, consumed: Record<string, number>, sold: Record<string, number>
  juice: { initial: number, received: number, used: number, lost: number, remain: number }
  members: ScoreMemberResult[], actions: ScoreAction[], segments: ScoreSegment[], warnings: string[]
}
export interface ScoreSolution {
  policy: ScorePolicy, mean: number, min: number, max: number, deviation: number, berry: number, zone: number, skill: number, cooking: number
  simulations: number, trace: ScoreTrace, sensitivity: { rollback: number, mean: number }[]
}
export interface ScoreRequest { settings: Settings, box: BoxPokemon[], options: ScoreOptions, checkpoint?: ScoreCheckpoint }
export interface ScoreResult { version: number, options: ScoreOptions, solutions: ScoreSolution[], excluded: ReturnType<typeof scoreCandidates>['excluded'], compared: number, simulations: number, elapsedMs: number, warnings: string[] }
export interface ScoreCheckpoint { version: number, fingerprint: string, phase: 'search' | 'review', index: number, policies: ScorePolicy[], finalists: ScoreSolution[], solutions: ScoreSolution[], elapsedMs: number, simulations: number }
export type ScoreMessage = { type: 'progress', completed: number, total: number } | { type: 'checkpoint', checkpoint: ScoreCheckpoint }
  | { type: 'result', result: ScoreResult } | { type: 'error', message: string }
export function seededRandom(seed: number) {
  let state = seed >>> 0
  return () => { state += 0x6D2B79F5; let x = state; x = Math.imul(x ^ x >>> 15, x | 1); x ^= x + Math.imul(x ^ x >>> 7, x | 61); return ((x ^ x >>> 14) >>> 0) / 4294967296 }
}
export function scoreTime(minute: number): string {
  const day = Math.floor((minute - 240) / 1440)
  const m = ((Math.floor(minute) % 1440) + 1440) % 1440
  return `${day < 0 ? '上周日' : day > 6 ? '下周一' : ['周一', '周二', '周三', '周四', '周五', '周六', '周日'][day]} ${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}
