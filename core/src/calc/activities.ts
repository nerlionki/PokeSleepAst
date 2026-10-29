import runtimeParameters from '../data/runtime-parameters.resource'
import ruleCatalogs from '../data/rule-catalogs.resource'
import extracted0 from '../data/runtime-contracts.resource'
import { cloneData } from './dataClone'
import catalog from '../data/activities.resource'
import parameters from '../data/event-parameters.resource'
import type { SleepStyleRow } from './data'
const activities_config_extracted0 = extracted0.modules.activities
const activities_validDate_runtimeParameters = runtimeParameters.modules.activities.validDate.values
const activities_validateActivityOverrides_runtimeParameters = runtimeParameters.modules.activities.validateActivityOverrides.values
const activities_config_ruleCatalogs = ruleCatalogs.modules.activities
const activities_parseActivityCatalog_runtimeParameters = runtimeParameters.modules.activities.parseActivityCatalog.values
const activities_localActivityDate_runtimeParameters = runtimeParameters.modules.activities.localActivityDate.values
const activities_offsetActivityDate_runtimeParameters = runtimeParameters.modules.activities.offsetActivityDate.values
const activities_createActivityContext_runtimeParameters = runtimeParameters.modules.activities.createActivityContext.values
const activities_activityDate_runtimeParameters = runtimeParameters.modules.activities.activityDate.values
const activities_activeActivities_runtimeParameters = runtimeParameters.modules.activities.activeActivities.values
const activities_activityValues_runtimeParameters = runtimeParameters.modules.activities.activityValues.values


export const EVENT_PARAMETERS = parameters
export const ACTIVITY_FIELDS = (cloneData(activities_config_extracted0.ACTIVITY_FIELDS) as unknown as {readonly "helpIntervalMultiplier":{readonly "label":"帮忙间隔倍率";readonly "kind":"multiply";readonly "min":0.01};readonly "berryCountBonus":{readonly "label":"每次帮忙额外树果";readonly "kind":"add";readonly "min":0};readonly "berryEnergyMultiplier":{readonly "label":"树果能量倍率";readonly "kind":"multiply";readonly "min":0};readonly "ingredientCountBonus":{readonly "label":"每次食材帮忙额外食材";readonly "kind":"add";readonly "min":0};readonly "skillRateMultiplier":{readonly "label":"技能触发率倍率";readonly "kind":"multiply";readonly "min":0};readonly "skillLevelBonus":{readonly "label":"临时主技能等级";readonly "kind":"add";readonly "min":0};readonly "skillStrengthMultiplier":{readonly "label":"主技能直接能量倍率";readonly "kind":"multiply";readonly "min":0};readonly "potSizeMultiplier":{readonly "label":"料理锅容量倍率";readonly "kind":"multiply";readonly "min":0.01};readonly "cookingEnergyMultiplier":{readonly "label":"料理能量倍率";readonly "kind":"multiply";readonly "min":0};readonly "cookingCritBonus":{readonly "label":"料理大成功率加成（0.1 = 10%）";readonly "kind":"add";readonly "min":0};readonly "cookingCritMultiplier":{readonly "label":"料理大成功能量倍率修正";readonly "kind":"multiply";readonly "min":0.01};readonly "drowsyPowerMultiplier":{readonly "label":"睡意之力倍率";readonly "kind":"multiply";readonly "min":0.01};readonly "researchExpMultiplier":{readonly "label":"研究 EXP 倍率";readonly "kind":"multiply";readonly "min":0};readonly "dreamShardsMultiplier":{readonly "label":"研究梦之碎片倍率";readonly "kind":"multiply";readonly "min":0};readonly "researchCandyMultiplier":{readonly "label":"研究糖果倍率";readonly "kind":"multiply";readonly "min":0};readonly "sleepExpMultiplier":{readonly "label":"睡眠 EXP 倍率";readonly "kind":"multiply";readonly "min":0};readonly "candyExpMultiplier":{readonly "label":"喂糖 EXP 倍率";readonly "kind":"multiply";readonly "min":0.01};readonly "candyShardMultiplier":{readonly "label":"喂糖梦之碎片倍率";readonly "kind":"multiply";readonly "min":0};readonly "encounterWeightMultiplier":{readonly "label":"出没权重倍率（模拟参数）";readonly "kind":"multiply";readonly "min":0}})
export type NumericActivityField = keyof typeof ACTIVITY_FIELDS
export type ActivityValues = Record<NumericActivityField, number> & { eventMix: 'off' | 'some' | 'all', shinyUp: boolean }
export type ActivityOverrides = Partial<ActivityValues>
export interface ActivityTarget { islands?: string[], pokemonIds?: number[], types?: string[], specialties?: string[] }
export interface ActivityRule { target?: ActivityTarget, effects: ActivityOverrides, firstResearchOnly?: boolean }
export interface ActivitySpawn extends SleepStyleRow { unlockRank: number }
export interface MiniCandyBoost { exp: number, shards: number, dailyLimit: number }
export interface ActivityPhase { startsOn: string, endsOn: string, weekdays?: number[], rules: ActivityRule[], spawns?: ActivitySpawn[] }
export interface Activity extends ActivityPhase { id: string, name: string, source: string, priority: number, phases?: ActivityPhase[], stacking?: 'max', miniCandyBoost?: MiniCandyBoost, favoriteBerries?: Record<string, string> }
export interface ActivityCatalog { schemaVersion: 1, version: string, activities: Activity[] }
export interface ActivitySelection { startDate?: string, overrides?: ActivityOverrides, catalog?: ActivityCatalog }
export interface ActivityContext extends ActivitySelection { startDate: string, catalog: ActivityCatalog }
export interface ActivityPokemon { id: number, berryType: string, specialty: string }

const fields = Object.keys(ACTIVITY_FIELDS) as NumericActivityField[]
const memberFields = new Set<string>((cloneData(activities_config_extracted0.memberFields) as string[]))
function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value) }
function validDate(value: unknown): value is string { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, (activities_validDate_runtimeParameters.p001 as 10)) === value }
function onlyKeys(value: Record<string, unknown>, keys: readonly string[], path: string) {
  for (const key of Object.keys(value)) if (!keys.includes(key)) throw new Error(`${path} 含不支持的字段：${key}`)
}
export function validateActivityOverrides(value: unknown): asserts value is ActivityOverrides {
  if (!record(value)) throw new Error('活动效果必须是对象')
  onlyKeys(value, [...fields, 'eventMix', 'shinyUp'], '活动效果')
  for (const key of fields) {
    const n = value[key]
    if (key in value && (typeof n !== 'number' || !Number.isFinite(n) || n < ACTIVITY_FIELDS[key].min || n > (activities_validateActivityOverrides_runtimeParameters.p001 as 10000))) throw new Error(`活动参数 ${key} 无效`)
  }
  if (value.skillLevelBonus != null && !Number.isInteger(value.skillLevelBonus)) throw new Error('临时技能等级必须为整数')
  if (value.cookingCritBonus != null && Number(value.cookingCritBonus) > 1) throw new Error('料理成功率加成不能超过 1')
  if ('eventMix' in value && !activities_config_ruleCatalogs.validateActivityOverridesList0.values.includes(String(value.eventMix))) throw new Error('跨睡眠类型配置无效')
  if ('shinyUp' in value && typeof value.shinyUp !== 'boolean') throw new Error('异色 UP 必须为布尔值')
}
/** Unknown effects fail closed instead of producing a plausible but incomplete result. */
export function parseActivityCatalog(value: unknown): ActivityCatalog {
  if (!record(value) || value.schemaVersion !== 1 || typeof value.version !== 'string' || !value.version || !Array.isArray(value.activities)) throw new Error('活动配置版本或结构不兼容')
  onlyKeys(value, activities_config_ruleCatalogs.parseActivityCatalogList0.values, '活动配置')
  const ids = new Set<string>()
  const phase = (v: unknown, parent?: Record<string, unknown>) => {
    if (!record(v) || !validDate(v.startsOn) || !validDate(v.endsOn) || v.startsOn >= v.endsOn || !Array.isArray(v.rules)) throw new Error('活动阶段需填写有效的开始日期和结束日期（不含结束日）')
    if (parent && (String(v.startsOn) < String(parent.startsOn) || String(v.endsOn) > String(parent.endsOn))) throw new Error('阶段日期不能超出活动日期')
    if (v.weekdays != null && (!Array.isArray(v.weekdays) || v.weekdays.some(n => !Number.isInteger(n) || n < 0 || n > (activities_parseActivityCatalog_runtimeParameters.p001 as 6)))) throw new Error('活动星期需为 0（周日）至 6')
    for (const rule of v.rules) {
      if (!record(rule)) throw new Error('活动规则结构无效')
      onlyKeys(rule, activities_config_ruleCatalogs.parseActivityCatalogList1.values, '活动规则')
      if (rule.firstResearchOnly != null && typeof rule.firstResearchOnly !== 'boolean') throw new Error('首次研究条件无效')
      validateActivityOverrides(rule.effects)
      if (rule.target != null) {
        if (!record(rule.target)) throw new Error('活动适用对象无效')
        onlyKeys(rule.target, activities_config_ruleCatalogs.parseActivityCatalogList2.values, '活动适用对象')
        for (const [key, values] of Object.entries(rule.target)) if (!Array.isArray(values) || !values.length || values.some(n => key === 'pokemonIds' ? !Number.isSafeInteger(n) || Number(n) <= 0 : typeof n !== 'string' || !n)) throw new Error(`活动对象 ${key} 无效`)
        if (activities_config_ruleCatalogs.parseActivityCatalogList3.values.some(k => k in (rule.target as object)) && Object.keys(rule.effects).some(k => !memberFields.has(k))) throw new Error('料理、睡意之力和跨类型等全局效果不能限定宝可梦；请拆分规则')
      }
    }
    if (v.spawns != null) {
      if (!Array.isArray(v.spawns)) throw new Error('活动出没资料无效')
      const seen = new Set<string>()
      for (const spawn of v.spawns) {
        if (!record(spawn) || !Number.isSafeInteger(spawn.pokeId) || Number(spawn.pokeId) <= 0 || typeof spawn.island !== 'string' || !spawn.island || !Number.isInteger(spawn.stars) || Number(spawn.stars) < 1 || Number(spawn.stars) > 5 || typeof spawn.dpr !== 'number' || !Number.isFinite(spawn.dpr) || spawn.dpr < 0 || !Number.isInteger(spawn.unlockRank) || Number(spawn.unlockRank) < 0 || Number(spawn.unlockRank) > 34 || typeof spawn.sleepType !== 'string' || typeof spawn.styleName !== 'string' || typeof spawn.name !== 'string' || spawn.limited === true || (spawn.styleId != null && !Number.isSafeInteger(spawn.styleId))) throw new Error('活动睡姿、DPR或评级无效')
        const key = `${spawn.island}:${spawn.pokeId}:${spawn.stars}:${spawn.styleId ?? ''}`
        if (seen.has(key)) throw new Error('活动睡姿重复')
        seen.add(key)
      }
    }
  }
  for (const v of value.activities) {
    if (!record(v) || typeof v.id !== 'string' || !v.id || ids.has(v.id) || typeof v.name !== 'string' || !v.name || typeof v.source !== 'string' || !v.source || !Number.isSafeInteger(v.priority)) throw new Error('活动 ID、名称、来源或优先级无效')
    onlyKeys(v, activities_config_ruleCatalogs.parseActivityCatalogList4.values, '活动')
    ids.add(v.id)
    phase(v)
    if (v.stacking != null && v.stacking !== 'max') throw new Error('活动叠加口径无效')
    if (v.favoriteBerries != null && (!record(v.favoriteBerries) || Object.values(v.favoriteBerries).some(berry => typeof berry !== 'string' || !berry))) throw new Error('活动喜好树果无效')
    if (v.miniCandyBoost != null) {
      const boost = v.miniCandyBoost
      if (!record(boost) || Object.keys(boost).some(key => !['exp', 'shards', 'dailyLimit'].includes(key)) || !['exp', 'shards', 'dailyLimit'].every(key => typeof boost[key] === 'number' && Number.isFinite(boost[key]) && Number(boost[key]) > 0) || !Number.isInteger(boost.dailyLimit)) throw new Error('迷你增强规则无效')
    }
    if (v.phases != null) {
      if (!Array.isArray(v.phases)) throw new Error('活动阶段必须是数组')
      for (const p of v.phases) { if (record(p)) onlyKeys(p, activities_config_ruleCatalogs.parseActivityCatalogList5.values, '活动阶段'); phase(p, v) }
    }
  }
  return JSON.parse(JSON.stringify(value)) as ActivityCatalog
}
export const ACTIVITY_CATALOG = parseActivityCatalog(catalog)

export function localActivityDate(now = new Date()): string {
  const date = new Date(now)
  date.setHours(date.getHours() - (activities_localActivityDate_runtimeParameters.p001 as 4))
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
export function offsetActivityDate(date: string, days: number): string {
  return new Date(Date.parse(date) + days * 86400000).toISOString().slice(0, (activities_offsetActivityDate_runtimeParameters.p001 as 10))
}
/** Week origin is Monday 00:00; effects still switch at local 04:00. Research origin is the current game date. */
export function createActivityContext(period: 'day' | 'week' | 'research', selection?: ActivitySelection, now = new Date()): ActivityContext {
  if (selection?.catalog && selection.startDate) return selection as ActivityContext
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const gameDate = localActivityDate(now)
  const startDate = selection?.startDate ?? (period === 'week' ? offsetActivityDate(gameDate, -((new Date(gameDate).getUTCDay() + (activities_createActivityContext_runtimeParameters.p001 as 6)) % (activities_createActivityContext_runtimeParameters.p002 as 7))) : period === 'research' ? gameDate : today)
  if (!validDate(startDate)) throw new Error('活动模拟起始日期无效')
  if (selection?.overrides) validateActivityOverrides(selection.overrides)
  return { startDate, catalog: ACTIVITY_CATALOG, overrides: { ...selection?.overrides } }
}
export function snapshotActivity<T extends { activity?: ActivitySelection, period?: 'day' | 'week' }>(value: T, period = value.period ?? 'day'): T & { activity: ActivityContext } {
  return { ...value, activity: createActivityContext(period, value.activity) }
}
export function activityDate(context: ActivityContext, minute = activities_activityDate_runtimeParameters.p001): string { return offsetActivityDate(context.startDate, Math.floor((minute - (activities_activityDate_runtimeParameters.p002 as 240)) / 1440)) }
function active(phase: ActivityPhase, date: string) { return phase.startsOn <= date && date < phase.endsOn && (!phase.weekdays || phase.weekdays.includes(new Date(date).getUTCDay())) }
function matches(target: ActivityTarget | undefined, island: string, pokemon?: ActivityPokemon) {
  return (!target?.islands || target.islands.includes(island)) && (!target?.pokemonIds || !!pokemon && target.pokemonIds.includes(pokemon.id))
    && (!target?.types || !!pokemon && target.types.includes(pokemon.berryType)) && (!target?.specialties || !!pokemon && target.specialties.includes(pokemon.specialty))
}
export function activeActivities(context: ActivityContext, minute = activities_activeActivities_runtimeParameters.p001): Activity[] {
  const date = activityDate(context, minute)
  return context.catalog.activities.filter(event => active(event, date)).sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id))
}
const valueCache = new WeakMap<ActivityContext, Map<string, ActivityValues>>()
export function activityValues(context: ActivityContext, island: string, pokemon?: ActivityPokemon, minute = activities_activityValues_runtimeParameters.p001, fallback?: ActivityOverrides, researchSession = 0): ActivityValues {
  let cache = valueCache.get(context)
  if (!cache) { cache = new Map(); valueCache.set(context, cache) }
  const cacheKey = `${Math.floor((minute - (activities_activityValues_runtimeParameters.p002 as 240)) / 1440)}|${island}|${pokemon?.id ?? ''}|${fallback ? JSON.stringify(fallback) : ''}|${researchSession}`
  const cached = cache.get(cacheKey)
  if (cached) return cached
  const values = Object.fromEntries(fields.map(key => [key, ACTIVITY_FIELDS[key].kind === 'add' ? 0 : 1])) as unknown as ActivityValues
  values.eventMix = 'off'; values.shinyUp = false
  const touched = new Set<string>()
  const date = activityDate(context, minute)
  const categorical = new Map<string, { priority: number, id: string }>()
  const maxValues: Partial<Record<NumericActivityField, number>> = {}
  for (const event of activeActivities(context, minute)) {
    for (const phase of [event, ...(event.phases ?? []).filter(p => active(p, date))]) {
      for (const rule of phase.rules) {
        if (!matches(rule.target, island, pokemon) || (rule.firstResearchOnly && researchSession > 0)) continue
        for (const key of fields) if (rule.effects[key] != null) {
          const n = rule.effects[key]!
          if (event.stacking === 'max') maxValues[key] = maxValues[key] == null ? n : key === 'helpIntervalMultiplier' ? Math.min(maxValues[key]!, n) : Math.max(maxValues[key]!, n)
          else values[key] = ACTIVITY_FIELDS[key].kind === 'add' ? values[key] + n : values[key] * n
          touched.add(key)
        }
        for (const key of (activities_config_ruleCatalogs.activityValuesList0.values as unknown as readonly ["eventMix","shinyUp"])) if (rule.effects[key] != null) {
          const previous = categorical.get(key)
          if (previous?.priority === event.priority && previous.id !== event.id && values[key] !== rule.effects[key]) throw new Error(`活动 ${key} 存在同优先级冲突，请调整配置`)
          Object.assign(values, { [key]: rule.effects[key] }); touched.add(key); categorical.set(key, { priority: event.priority, id: event.id })
        }
      }
    }
  }
  for (const key of fields) if (maxValues[key] != null) values[key] = ACTIVITY_FIELDS[key].kind === 'add' ? values[key] + maxValues[key]! : values[key] * maxValues[key]!
  for (const [key, value] of Object.entries(fallback ?? {})) if (!touched.has(key)) Object.assign(values, { [key]: value })
  Object.assign(values, context.overrides)
  for (const key of fields) if (!Number.isFinite(values[key])) throw new Error(`活动叠加后的 ${key} 无效`)
  cache.set(cacheKey, Object.freeze(values))
  return values
}

/** Activity rows replace only their matching island/style; the bundled pool is never mutated. */
export function activitySleepStyles(base: readonly SleepStyleRow[], context = createActivityContext('research')): SleepStyleRow[] {
  const phases = activeActivities(context).flatMap(event => [event, ...(event.phases ?? []).filter(phase => active(phase, activityDate(context)))])
  const spawns = phases.flatMap(phase => phase.spawns ?? [])
  if (!spawns.length) return base.filter(style => !style.limited)
  const overrides = new Set(spawns.map(style => `${style.island}:${style.pokeId}:${style.stars}`))
  return [...base.filter(style => !style.limited && !overrides.has(`${style.island}:${style.pokeId}:${style.stars}`)), ...spawns]
}

/** undefined means a legacy what-if catalog; null means a configured event is currently unavailable. */
export function activityMiniCandyBoost(context: ActivityContext): MiniCandyBoost | null | undefined {
  const active = activeActivities(context).filter(event => event.miniCandyBoost)
  if (active.length) return active.at(-1)!.miniCandyBoost!
  return context.catalog.activities.some(event => event.miniCandyBoost) ? null : undefined
}

/** Only the guaranteed berry is supplied; other choices stay under user control. */
export function activityBerrySettings<T extends { island: string, berries: string[] }>(settings: T, context: ActivityContext, minute = 240): T {
  const berry = activeActivities(context, minute).map(event => event.favoriteBerries?.[settings.island]).filter(Boolean).at(-1)
  if (!berry) return settings
  return { ...settings, berries: [berry, ...settings.berries.filter(name => name !== berry)].slice(0, 3) }
}
