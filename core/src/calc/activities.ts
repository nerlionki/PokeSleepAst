import { normalizeActivityOverrides } from './legacyActivityOverrides'
import runtimeParameters from '../data/runtime-parameters.resource'
import extracted0 from '../data/runtime-contracts.resource'
import catalog from '../data/activities.resource'
import parameters from '../data/event-parameters.resource'
import mythical from '../data/mythical.resource'
import { skillByPokedexName } from './mainSkills'
import { foldText } from './text'
import type { SleepStyleRow } from './data'
import { NUMERIC_ACTIVITY_EFFECTS, validateActivityCatalog, validateActivityEffects, type NumericActivityField, type ActivityValues, type ActivityOverrides, type ActivityTarget, type ActivityRule, type RecipeEnergyModifier, type ActivityFeature, type ActivityDomain } from '../resources/activityModel'
export type { NumericActivityField, ActivityValues, ActivityOverrides, ActivityTarget, ActivityRule, RecipeEnergyModifier, ActivityFeature, ActivityDomain } from '../resources/activityModel'
const activities_localActivityDate_runtimeParameters = runtimeParameters.modules.activities.localActivityDate.values
const activities_offsetActivityDate_runtimeParameters = runtimeParameters.modules.activities.offsetActivityDate.values
const activities_createActivityContext_runtimeParameters = runtimeParameters.modules.activities.createActivityContext.values
const activities_activityDate_runtimeParameters = runtimeParameters.modules.activities.activityDate.values
const activities_activeActivities_runtimeParameters = runtimeParameters.modules.activities.activeActivities.values
const activities_activityValues_runtimeParameters = runtimeParameters.modules.activities.activityValues.values
export const EVENT_PARAMETERS = parameters
export const ACTIVITY_FIELDS = extracted0.modules.activities.ACTIVITY_FIELDS as Record<NumericActivityField, { label: string; kind: 'add' | 'multiply'; min: number; max: number; step: number | 'any' }>
export interface ActivitySpawn extends SleepStyleRow { unlockRank: number }
export interface MiniCandyBoost { exp: number, shards: number, dailyLimit: number }
export interface ActivityPhase { startsOn: string, endsOn: string, weekdays?: number[], rules: ActivityRule[], spawns?: ActivitySpawn[] }
export interface Activity extends ActivityPhase { id: string, name: string, source: string, priority: number, phases?: ActivityPhase[], stacking?: 'max', miniCandyBoost?: MiniCandyBoost, favoriteBerries?: Record<string, string>, features?: ActivityFeature[], tutorialEligible?: boolean }
export interface ActivityCatalog { schemaVersion: 1 | 2, modelVersion?: number, requiredCapabilities?: string[], version: string, activities: Activity[] }
export interface ActivitySelection { startDate?: string, overrides?: ActivityOverrides, catalog?: ActivityCatalog, teamPokemonIds?: number[], tutorial?: boolean, measurementStartedAt?: string }
export interface ActivityContext extends ActivitySelection { startDate: string, catalog: ActivityCatalog }
export interface ActivityPokemon { id: number, berryType: string, specialty: string, name?: string, mainSkill?: string }
const fields = Object.keys(NUMERIC_ACTIVITY_EFFECTS) as NumericActivityField[]
function validDate(value: unknown): value is string { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value }
export function validateActivityOverrides(value: unknown): asserts value is ActivityOverrides { validateActivityEffects(value) }
export function parseActivityCatalog(value: unknown): ActivityCatalog { validateActivityCatalog(value); return JSON.parse(JSON.stringify(value)) as ActivityCatalog }
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
  if (selection?.catalog && selection.startDate) {
    const legacy = selection.overrides as Record<string, unknown> | undefined
    return legacy && ['fixedNutBonus', 'nutRecipeEnergyMultiplier', 'extraNutEnergyMultiplier'].some(key => key in legacy)
      ? { ...selection, overrides: normalizeActivityOverrides(legacy) } as ActivityContext : selection as ActivityContext
  }
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const measurement = selection?.measurementStartedAt ? new Date(selection.measurementStartedAt) : undefined
  if (measurement && !Number.isFinite(measurement.getTime())) throw new Error('睡眠测量开始时间无效')
  const gameDate = localActivityDate(period === 'research' && measurement ? measurement : now)
  const startDate = selection?.startDate ?? (period === 'week' ? offsetActivityDate(gameDate, -((new Date(gameDate).getUTCDay() + (activities_createActivityContext_runtimeParameters.p001 as 6)) % (activities_createActivityContext_runtimeParameters.p002 as 7))) : period === 'research' ? gameDate : today)
  if (!validDate(startDate)) throw new Error('活动模拟起始日期无效')
  const overrides = normalizeActivityOverrides(selection?.overrides ?? {})
  return { startDate, catalog: ACTIVITY_CATALOG, overrides, teamPokemonIds: [...(selection?.teamPokemonIds ?? [])], tutorial: selection?.tutorial ?? false, measurementStartedAt: selection?.measurementStartedAt }
}
export function snapshotActivity<T extends { activity?: ActivitySelection, period?: 'day' | 'week' }>(value: T, period = value.period ?? 'day'): T & { activity: ActivityContext } {
  return { ...value, activity: createActivityContext(period, value.activity) }
}
export function activityDate(context: ActivityContext, minute = activities_activityDate_runtimeParameters.p001): string { return offsetActivityDate(context.startDate, Math.floor((minute - (activities_activityDate_runtimeParameters.p002 as 240)) / 1440)) }
function active(phase: ActivityPhase, date: string) { return phase.startsOn <= date && date < phase.endsOn && (!phase.weekdays || phase.weekdays.includes(new Date(date).getUTCDay())) }
function matches(target: ActivityTarget | undefined, island: string, pokemon?: ActivityPokemon) {
  const skill = pokemon?.mainSkill ? skillByPokedexName(pokemon.mainSkill, pokemon.id) : undefined
  return (!target?.islands || target.islands.includes(island)) && (!target?.pokemonIds || !!pokemon && target.pokemonIds.includes(pokemon.id))
    && (!target?.pokemonNames || !!pokemon?.name && target.pokemonNames.includes(pokemon.name))
    && (!target?.types || !!pokemon && target.types.includes(pokemon.berryType)) && (!target?.specialties || !!pokemon && target.specialties.includes(pokemon.specialty))
    && (!target?.skillIds || !!skill && target.skillIds.includes(skill.id))
    && (!target?.skillFamilies || !!pokemon?.mainSkill && target.skillFamilies.some(family => foldText(pokemon.mainSkill!).includes(foldText(family))))
}
export function activeActivities(context: ActivityContext, minute = activities_activeActivities_runtimeParameters.p001): Activity[] {
  const date = activityDate(context, minute)
  return context.catalog.activities.filter(event => active(event, date) && (!context.tutorial || event.tutorialEligible === true)).sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id))
}
const valueCache = new WeakMap<ActivityContext, Map<string, ActivityValues>>()
/** User-selected planning convention: any applicable encounter UP enables the
 * special-encounter default. This is a default, not proof of an actual encounter.
 */
export function activityHasPokemonUp(context: ActivityContext, island: string): boolean {
  const date = activityDate(context)
  return activeActivities(context).some(event =>
    [event, ...(event.phases ?? []).filter(phase => active(phase, date))].some(phase =>
      phase.rules.some(rule => (rule.effects.encounterWeightMultiplier ?? 1) > 1
        && (!rule.target?.islands || rule.target.islands.includes(island)))))
}

export function activityValues(context: ActivityContext, island: string, pokemon?: ActivityPokemon, minute = activities_activityValues_runtimeParameters.p001, fallback?: ActivityOverrides, researchSession = 0): ActivityValues {
  let cache = valueCache.get(context)
  if (!cache) { cache = new Map(); valueCache.set(context, cache) }
  const cacheKey = JSON.stringify([activityDate(context, minute), island, pokemon ? [pokemon.id, pokemon.berryType, pokemon.specialty, pokemon.name, pokemon.mainSkill] : null, fallback, researchSession, context.teamPokemonIds ?? [], context.overrides, context.tutorial])
  const cached = cache.get(cacheKey)
  if (cached) return cached
  const values = Object.fromEntries(fields.map(key => [key, NUMERIC_ACTIVITY_EFFECTS[key] === 'add' ? 0 : 1])) as unknown as ActivityValues
  Object.assign(values, { eventMix: 'off', shinyUp: false, allRecipeCategories: false, fixedIngredientDrops: {}, extraIngredientEnergyMultipliers: {}, recipeEnergyModifiers: [], availableRecipeCategories: [], favoredBerries: [] })
  const touched = new Set<string>()
  const date = activityDate(context, minute)
  const weekday = new Date(date).getUTCDay()
  const categorical = new Map<string, { priority: number, id: string }>()
  const maximum: Partial<Record<NumericActivityField, number>> = {}
  const maps: Record<string, Record<string, number>> = { fixedIngredientDrops: {}, extraIngredientEnergyMultipliers: {} }
  for (const event of activeActivities(context, minute)) {
    for (const phase of [event, ...(event.phases ?? []).filter(p => active(p, date))]) {
      for (const rule of phase.rules) {
        if (!matches(rule.target, island, pokemon) || (rule.firstResearchOnly && researchSession > 0)
          || rule.conditions?.weekdays && !rule.conditions.weekdays.includes(weekday)
          || rule.conditions?.teamPokemonIdsAny && !rule.conditions.teamPokemonIdsAny.some(id => context.teamPokemonIds?.includes(id))) continue
        for (const key of fields) if (rule.effects[key] != null) {
          const n = rule.effects[key]!
          if (event.stacking === 'max') maximum[key] = maximum[key] == null ? n : key === 'helpIntervalMultiplier' ? Math.min(maximum[key]!, n) : Math.max(maximum[key]!, n)
          else values[key] = NUMERIC_ACTIVITY_EFFECTS[key] === 'add' ? values[key] + n : values[key] * n
          touched.add(key)
        }
        for (const key of ['fixedIngredientDrops', 'extraIngredientEnergyMultipliers'] as const) {
          for (const [name, number] of Object.entries(rule.effects[key] ?? {})) {
            if (event.stacking === 'max') maps[key]![name] = Math.max(maps[key]![name] ?? number, number)
            else values[key][name] = key === 'fixedIngredientDrops' ? (values[key][name] ?? 0) + number : (values[key][name] ?? 1) * number
          }
          if (rule.effects[key]) touched.add(key)
        }
        for (const modifier of rule.effects.recipeEnergyModifiers ?? []) {
          const previous = values.recipeEnergyModifiers.find(row => row.id === modifier.id)
          if (previous) {
            const selector = (row: RecipeEnergyModifier) => JSON.stringify([row.ingredientNames, row.recipeNames, row.categories])
            if (selector(previous) !== selector(modifier)) throw new Error(`活动料理加成 ${modifier.id} 的条件冲突`)
            previous.multiplier = event.stacking === 'max' ? Math.max(previous.multiplier, modifier.multiplier) : previous.multiplier * modifier.multiplier
          } else values.recipeEnergyModifiers.push({ ...modifier })
          touched.add('recipeEnergyModifiers')
        }
        for (const key of ['eventMix', 'shinyUp', 'allRecipeCategories', 'availableRecipeCategories', 'favoredBerries'] as const) if (rule.effects[key] != null) {
          const previous = categorical.get(key)
          if (previous?.priority === event.priority && previous.id !== event.id && JSON.stringify(values[key]) !== JSON.stringify(rule.effects[key])) throw new Error(`活动 ${key} 存在同优先级冲突，请调整配置`)
          Object.assign(values, { [key]: rule.effects[key] }); touched.add(key); categorical.set(key, { priority: event.priority, id: event.id })
        }
      }
    }
  }
  for (const key of fields) if (maximum[key] != null) values[key] = NUMERIC_ACTIVITY_EFFECTS[key] === 'add' ? values[key] + maximum[key]! : values[key] * maximum[key]!
  for (const key of ['fixedIngredientDrops', 'extraIngredientEnergyMultipliers'] as const) for (const [name, number] of Object.entries(maps[key]!)) values[key][name] = key === 'fixedIngredientDrops' ? (values[key][name] ?? 0) + number : (values[key][name] ?? 1) * number
  for (const [key, value] of Object.entries(fallback ?? {})) if (!touched.has(key)) Object.assign(values, { [key]: value })
  Object.assign(values, context.overrides)
  if (context.overrides?.allRecipeCategories === false) values.availableRecipeCategories = []
  else if (values.allRecipeCategories) values.availableRecipeCategories = ['curry', 'salad', 'dessert']
  values.allRecipeCategories = values.availableRecipeCategories.length === 3
  for (const key of fields) if (!Number.isFinite(values[key])) throw new Error(`活动叠加后的 ${key} 无效`)
  // Detach structured overrides from caller-owned settings before caching.
  values.fixedIngredientDrops = Object.freeze({ ...values.fixedIngredientDrops })
  values.extraIngredientEnergyMultipliers = Object.freeze({ ...values.extraIngredientEnergyMultipliers })
  values.recipeEnergyModifiers = values.recipeEnergyModifiers.map(row => Object.freeze({ ...row }))
  values.availableRecipeCategories = [...values.availableRecipeCategories]
  values.favoredBerries = [...values.favoredBerries]
  Object.freeze(values.availableRecipeCategories); Object.freeze(values.favoredBerries); Object.freeze(values.recipeEnergyModifiers)
  cache.set(cacheKey, Object.freeze(values))
  return values
}

export function activityFeatures(context: ActivityContext, domain?: ActivityDomain, minute = 240, island?: string) {
  return activeActivities(context, minute).flatMap(event => (event.features ?? []).filter(feature => (!domain || feature.domains.includes(domain)) && (!feature.islands || island != null && feature.islands.includes(island))))
}
export function assertActivitySupported(context: ActivityContext, domain: ActivityDomain, minute = 240, island?: string, researchSession = 0) {
  const pending = activityFeatures(context, domain, minute, island).filter(feature => {
    // Older resource snapshots marked the optional mythical draw as required.
    if (domain === 'research' && feature.id === 'special-encounter') return false
    return feature.status !== 'informational' && !(feature.parameters?.firstResearchOnly === true && researchSession > 0)
  })
  if (pending.length) throw new Error(pending.map(feature => `${feature.name}：${feature.description}`).join('；'))
}
export function activityRecipeCategories(values: ActivityValues, selected: string) { return values.availableRecipeCategories.length ? values.availableRecipeCategories : [selected] }

/** Activity rows replace only their matching island/style; the bundled pool is never mutated. */
export function activitySleepStyles(base: readonly SleepStyleRow[], context = createActivityContext('research')): SleepStyleRow[] {
  const phases = activeActivities(context).flatMap(event => [event, ...(event.phases ?? []).filter(phase => active(phase, activityDate(context)))])
  // Event-only mythical encounters are recorded in the Pokédex, outside the simulated pool.
  const ordinary = (style: SleepStyleRow) => !Object.hasOwn(mythical, style.pokeId)
  const spawns = phases.flatMap(phase => phase.spawns ?? []).filter(ordinary)
  if (!spawns.length) return base.filter(style => !style.limited && ordinary(style))
  const overrides = new Set(spawns.map(style => `${style.island}:${style.pokeId}:${style.stars}`))
  return [...base.filter(style => !style.limited && ordinary(style) && !overrides.has(`${style.island}:${style.pokeId}:${style.stars}`)), ...spawns]
}

/** undefined means a legacy what-if catalog; null means a configured event is currently unavailable. */
export function activityMiniCandyBoost(context: ActivityContext): MiniCandyBoost | null | undefined {
  const active = activeActivities(context).filter(event => event.miniCandyBoost)
  if (active.length) return active.at(-1)!.miniCandyBoost!
  return context.catalog.activities.some(event => event.miniCandyBoost) ? null : undefined
}

/** Only the guaranteed berry is supplied; other choices stay under user control. */
export function activityBerrySettings<T extends { island: string, berries: string[] }>(settings: T, context: ActivityContext, minute = 240): T {
  const configured = activityValues(context, settings.island, undefined, minute).favoredBerries
  const legacy = activeActivities(context, minute).map(event => event.favoriteBerries?.[settings.island]).filter((name): name is string => !!name).at(-1)
  const berries = configured.length ? configured : legacy ? [legacy] : []
  if (!berries.length) return settings
  return { ...settings, berries: [...berries, ...settings.berries.filter(name => !berries.includes(name))].slice(0, 3) }
}
