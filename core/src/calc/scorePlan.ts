import runtimeParameters from '../data/runtime-parameters.json'
import ruleCatalogs from '../data/rule-catalogs.json'
import clientFactoryDefaults from '../data/client-defaults.json'
import { cloneData } from './dataClone'
import extracted0 from '../data/client-defaults.json'
import type { BoxPokemon, MealCategory, Settings } from '../types'
import { INGREDIENTS, NATURES, pokeById } from './data'
import { POKEMON_LEVEL_MAX } from './xp'
import { unlockedSubskills } from './member'
import { skillByPokedexName } from './mainSkills'
import { resolveMemberSkill } from './mew'
const scorePlan_config_extracted0 = extracted0.modules.scorePlan
const factory_scorePlan_config_clientFactoryDefaults = clientFactoryDefaults.modules.factory_scorePlan
const scorePlan_clockIn_runtimeParameters = runtimeParameters.modules.scorePlan.clockIn.values
const scorePlan_scoreBounds_runtimeParameters = runtimeParameters.modules.scorePlan.scoreBounds.values
const scorePlan_scoreSleeps_runtimeParameters = runtimeParameters.modules.scorePlan.scoreSleeps.values
const scorePlan_validateScoreOptions_runtimeParameters = runtimeParameters.modules.scorePlan.validateScoreOptions.values
const scorePlan_config_ruleCatalogs = ruleCatalogs.modules.scorePlan
const scorePlan_scoreCandidates_runtimeParameters = runtimeParameters.modules.scorePlan.scoreCandidates.values
const scorePlan_scoreTime_runtimeParameters = runtimeParameters.modules.scorePlan.scoreTime.values


export const SCORE_RULE_VERSION = (scorePlan_config_extracted0.SCORE_RULE_VERSION as 3)
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
  const sleep = (start: string, end: string): ScoreSleep => ({ start, end, classification: (factory_scorePlan_config_clientFactoryDefaults["defaultScoreOptions_nested_classification"] as "auto"), extreme: (factory_scorePlan_config_clientFactoryDefaults["defaultScoreOptions_nested_extreme"] as "auto"), collectMinutes: (factory_scorePlan_config_clientFactoryDefaults["defaultScoreOptions_nested_collectMinutes"] as 60), settleDelay: (factory_scorePlan_config_clientFactoryDefaults["defaultScoreOptions_nested_settleDelay"] as 0) })
  return { startDay: (factory_scorePlan_config_clientFactoryDefaults["defaultScoreOptions_startDay"] as 0), startTime: (factory_scorePlan_config_clientFactoryDefaults["defaultScoreOptions_startTime"] as "04:00"), days: (factory_scorePlan_config_clientFactoryDefaults["defaultScoreOptions_days"] as 7), initialStrength: (factory_scorePlan_config_clientFactoryDefaults["defaultScoreOptions_initialStrength"] as 0), bag: cloneData(factory_scorePlan_config_clientFactoryDefaults["defaultScoreOptions_bag"]), category: settings?.mealCategory ?? 'curry',
    meals: cloneData(factory_scorePlan_config_clientFactoryDefaults["defaultScoreOptions_meals"]) as ScoreOptions['meals'], collectMinutes: (factory_scorePlan_config_clientFactoryDefaults["defaultScoreOptions_collectMinutes"] as 60), precision: (factory_scorePlan_config_clientFactoryDefaults["defaultScoreOptions_precision"] as "medium"), seed: (factory_scorePlan_config_clientFactoryDefaults["defaultScoreOptions_seed"] as 20261012),
    initialDisguise: cloneData(factory_scorePlan_config_clientFactoryDefaults["defaultScoreOptions_initialDisguise"]), initialCrit: (factory_scorePlan_config_clientFactoryDefaults["defaultScoreOptions_initialCrit"] as 0), initialPot: (factory_scorePlan_config_clientFactoryDefaults["defaultScoreOptions_initialPot"] as 0), initialZone: (factory_scorePlan_config_clientFactoryDefaults["defaultScoreOptions_initialZone"] as 0), initialJuice: (factory_scorePlan_config_clientFactoryDefaults["defaultScoreOptions_initialJuice"] as 0), useJuice: (factory_scorePlan_config_clientFactoryDefaults["defaultScoreOptions_useJuice"] as true),
    splitSleep: (factory_scorePlan_config_clientFactoryDefaults["defaultScoreOptions_splitSleep"] as false), device: (factory_scorePlan_config_clientFactoryDefaults["defaultScoreOptions_device"] as false), dayStart: (factory_scorePlan_config_clientFactoryDefaults["defaultScoreOptions_dayStart"] as "08:00"), dayEnd: (factory_scorePlan_config_clientFactoryDefaults["defaultScoreOptions_dayEnd"] as "22:00"),
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
  const m = ((minute % 1440) + (scorePlan_clockIn_runtimeParameters.p001 as 1440)) % 1440
  return start < end ? m >= start && m < end : m >= start || m < end
}
export function scoreBounds(o: ScoreOptions) {
  const start = o.startDay * 1440 + hm(o.startTime)
  return { start, end: Math.min(start + o.days * 1440, (scorePlan_scoreBounds_runtimeParameters.p001 as 7) * 1440 + (scorePlan_scoreBounds_runtimeParameters.p002 as 240)) }
}
export function extremeSleep(o: ScoreOptions, sleep: ScoreSleep): boolean {
  const day = sleep.classification === 'day' || sleep.classification === 'auto' && clockIn(hm(sleep.start), hm(o.dayStart), hm(o.dayEnd))
  return o.device && (sleep.extreme === 'on' || sleep.extreme === 'auto' && day) && sleep.collectMinutes > 0
}
export interface SleepSession { slot: number, start: number, end: number, settle: number, score: number, day: number, collect: boolean }
export function scoreSleeps(o: ScoreOptions, settings: Settings): SleepSession[] {
  const { start, end } = scoreBounds(o)
  const sessions: SleepSession[] = []
  for (let day = -1; day <= (scorePlan_scoreSleeps_runtimeParameters.p001 as 7); day++) {
    for (const [slot, sleep] of o.sleeps.slice(0, o.splitSleep ? 2 : 1).entries()) {
      const a = day * 1440 + hm(sleep.start)
      const b = a + ((hm(sleep.end) - hm(sleep.start) + (scorePlan_scoreSleeps_runtimeParameters.p002 as 1440)) % 1440)
      if (a < end && b > start) sessions.push({ slot, start: a, end: b, settle: b + (o.device ? sleep.settleDelay : 0),
        score: o.splitSleep ? Math.min((scorePlan_scoreSleeps_runtimeParameters.p003 as 100), Math.floor((b - a) / (scorePlan_scoreSleeps_runtimeParameters.p004 as 5.1))) : settings.sleepScore,
        day: Math.floor((a - (scorePlan_scoreSleeps_runtimeParameters.p005 as 240)) / 1440), collect: extremeSleep(o, sleep) })
    }
  }
  return sessions.sort((a, b) => a.start - b.start)
}
export function validateScoreOptions(o: ScoreOptions, settings: Settings): string | null {
  const integer = (v: number, min: number, max: number) => Number.isSafeInteger(v) && v >= min && v <= max
  if (!integer(o.startDay, 0, (scorePlan_validateScoreOptions_runtimeParameters.p001 as 6)) || !integer(o.days, 1, (scorePlan_validateScoreOptions_runtimeParameters.p002 as 7) - o.startDay)) return '规划天数不能超过本周剩余天数'
  if (!Number.isFinite(hm(o.startTime)) || o.startDay === 0 && hm(o.startTime) < (scorePlan_validateScoreOptions_runtimeParameters.p003 as 240)) return '开始时刻须在本周一 04:00 之后'
  if (!integer(o.initialStrength, 0, Number.MAX_SAFE_INTEGER)) return '卡比兽初始能量须为非负整数'
  if (!scorePlan_config_ruleCatalogs.validateScoreOptionsList0.values.includes(o.category) || !scorePlan_config_ruleCatalogs.validateScoreOptionsList1.values.includes(o.precision)) return '请选择料理类型和搜索精度'
  if (!integer(o.collectMinutes, (scorePlan_validateScoreOptions_runtimeParameters.p004 as 5), (scorePlan_validateScoreOptions_runtimeParameters.p005 as 240))) return '收菜间隔须为 5–240 分钟'
  if (!integer(o.seed, 1, (scorePlan_validateScoreOptions_runtimeParameters.p006 as 2147483647))) return '规划参数无效，请恢复默认设置'
  if (!Number.isFinite(o.initialCrit) || o.initialCrit < 0 || o.initialCrit > (scorePlan_validateScoreOptions_runtimeParameters.p007 as 70) || !integer(o.initialPot, 0, (scorePlan_validateScoreOptions_runtimeParameters.p008 as 200))
    || !Number.isFinite(o.initialZone) || o.initialZone < 0 || o.initialZone > (scorePlan_validateScoreOptions_runtimeParameters.p009 as 24) || !integer(o.initialJuice, 0, (scorePlan_validateScoreOptions_runtimeParameters.p010 as 5))) return '初始技能或道具加成超出允许范围'
  if (Object.entries(o.bag).some(([name, n]) => !INGREDIENTS.some(i => i.name === name) || !integer(n, 0, (scorePlan_validateScoreOptions_runtimeParameters.p011 as 800)))
    || Object.values(o.bag).reduce((a, b) => a + b, 0) > (scorePlan_validateScoreOptions_runtimeParameters.p012 as 800)) return '初始食材须为整数，合计不能超过 800'
  if (o.meals.length !== 3 || o.meals.some((m, i) => !Number.isFinite(hm(m)) || hm(m) < scorePlan_config_ruleCatalogs.validateScoreOptionsList2.values[i]! || hm(m) >= scorePlan_config_ruleCatalogs.validateScoreOptionsList3.values[i]!)) return '做饭时间须分别位于早餐 06:00–11:59、午餐 12:00–17:59、晚餐 18:00–23:59'
  if (!Number.isFinite(hm(o.dayStart)) || !Number.isFinite(hm(o.dayEnd)) || o.dayStart === o.dayEnd) return '白天分类范围须为两个不同的有效时刻'
  for (const s of o.sleeps.slice(0, o.splitSleep ? 2 : 1)) {
    if (!Number.isFinite(hm(s.start)) || !Number.isFinite(hm(s.end)) || s.start === s.end) return '睡眠开始和结束须为不同的有效时刻'
    if (!integer(s.collectMinutes, 0, (scorePlan_validateScoreOptions_runtimeParameters.p013 as 240)) || s.collectMinutes > 0 && s.collectMinutes < (scorePlan_validateScoreOptions_runtimeParameters.p014 as 5) || !integer(s.settleDelay, 0, (scorePlan_validateScoreOptions_runtimeParameters.p015 as 1440))) return '睡眠收菜间隔须为 0 或 5–240 分钟，结算延迟须为 0–1440 分钟'
    if (o.meals.some(m => clockIn(hm(m), hm(s.start), hm(s.end))) && !extremeSleep(o, s)) return '做饭时间与不收菜的睡眠冲突，请在详细设置调整餐次或睡眠时间'
  }
  const sleeps = scoreSleeps(o, settings)
  if (sleeps.some((s, i) => i > 0 && s.start < sleeps[i - 1]!.end)) return '两段睡眠不能重叠'
  if (!Number.isFinite(settings.areaBonus) || settings.areaBonus < 0 || settings.areaBonus > (scorePlan_validateScoreOptions_runtimeParameters.p016 as 0.85) || !integer(settings.potSize, 1, (scorePlan_validateScoreOptions_runtimeParameters.p017 as 1000))) return '请先检查岛屿加成和锅容量设置'
  return null
}
export function scoreCandidates(box: BoxPokemon[]) {
  const excluded: { uid: string, name: string, reason: string }[] = []
  const seen = new Set<string>()
  const candidates = box.filter(p => {
    const poke = pokeById(p.pokeId)
    const slots = p.level >= (scorePlan_scoreCandidates_runtimeParameters.p001 as 60) ? 3 : p.level >= (scorePlan_scoreCandidates_runtimeParameters.p002 as 30) ? 2 : 1
    let reason = ''
    if (!p.uid || seen.has(p.uid)) reason = '个体标识为空或重复'
    else if (p.napping) reason = '正在午睡岛，无法上场'
    else if (!poke || poke.interval <= 0) reason = '缺少生产资料'
    else if (!Number.isInteger(p.level) || p.level < 1 || p.level > POKEMON_LEVEL_MAX || !NATURES.some(n => n.name === p.nature)) reason = '等级或性格无效'
    else if (!Number.isInteger(p.skillLevel) || p.skillLevel < 1 || !skillByPokedexName(resolveMemberSkill(poke, p).name, p.pokeId)) reason = '主技能配置无效'
    else if (p.ocrMissing?.some(f => scorePlan_config_ruleCatalogs.scoreCandidatesList0.values.includes(f)
      || f.startsWith('ingredient') && Number(f.at(-1)) < slots
      || f.startsWith('subskill') && p.level >= scorePlan_config_ruleCatalogs.scoreCandidatesList1.values[Number(f.at(-1))]!)) reason = '生产相关 OCR 字段尚未确认'
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
  const day = Math.floor((minute - (scorePlan_scoreTime_runtimeParameters.p001 as 240)) / 1440)
  const m = ((Math.floor(minute) % 1440) + (scorePlan_scoreTime_runtimeParameters.p002 as 1440)) % 1440
  return `${day < 0 ? '上周日' : day > (scorePlan_scoreTime_runtimeParameters.p003 as 6) ? '下周一' : scorePlan_config_ruleCatalogs.scoreTimeList0.values[day]} ${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}
