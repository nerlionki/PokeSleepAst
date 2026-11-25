import runtimeParameters from '../data/runtime-parameters.resource'
import ruleCatalogs from '../data/rule-catalogs.resource'
import ruleParameters from '../data/rule-parameters.resource'
import extracted0 from '../data/calc-tables.resource'
import { cloneData } from './dataClone'
import { ACTIVITY_CATALOG, EVENT_PARAMETERS, activeActivities, researchActivity, researchSleepStyles, activityValues, assertActivitySupported, hasLegacyShinyUp, type ActivityContext, type ResearchActivityContext, type ResearchActivitySelection } from './activities'
import { hasResearchDpr } from './researchAvailability'
import { normalizeEventMix, openSleepSlots, RAE_RESTRICTED_LEADER_CHANCE, sleepEncounterWeight, type EventMix, type PokemonUps } from './sleepRules'
import { prepareRaeSleepDraw, runRaeSleepLottery, type RaeSleepCandidate } from './raeSleepLottery'
import { createSleepRandom } from './sleepTransition'
import { isLastRollExcluded, isRaeFiller, raeSpoBudget, raeSpoCost, RAE_SPO_RATE, requireRaeSleepLottery } from './sleepLastRoll'
import snorlaxRanks from '../data/snorlax-ranks.resource'
import type { IslandId, SleepType } from '../types'
import { ENCOUNTER_BANDS, ISLANDS, islandById, pokeById, SLEEP_STYLES, type SleepStyleRow } from './data'
import { boostedResearchReward, dailyResearchReward, sleepReward, sleepStyleInternalId, type ResearchBonuses } from './sleepRewards'
const sleep_config_extracted0 = extracted0.modules.sleep
const sleep_sleepMinutes_ruleParameters = ruleParameters.modules.sleep.sleepMinutes
const sleep_energyLost_ruleParameters = ruleParameters.modules.sleep.energyLost
const sleep_strengthToNext_ruleParameters = ruleParameters.modules.sleep.strengthToNext
const sleep_encounterCount_ruleParameters = ruleParameters.modules.sleep.encounterCount
const sleep_config_ruleCatalogs = ruleCatalogs.modules.sleep
const sleep_sleepDraw_runtimeParameters = runtimeParameters.modules.sleep.sleepDraw.values
const sleep_sleepExpectSteps_ruleParameters = ruleParameters.modules.sleep.sleepExpectSteps
const sleep_sleepExpectSteps_runtimeParameters = runtimeParameters.modules.sleep.sleepExpectSteps.values
const sleep_sleepExpect_ruleParameters = ruleParameters.modules.sleep.sleepExpect


type BandKey = keyof typeof ENCOUNTER_BANDS

export const SHINY_BASE = EVENT_PARAMETERS.sleep.shinySimulationBase ?? 0.008
export const SHINY_NEW_MOON = EVENT_PARAMETERS.sleep.shinyNewMoon ?? 0.015
export const SHINY_EVENT = EVENT_PARAMETERS.sleep.shinyEvent

export function sleepShinyRate(context: ActivityContext, shinyUp = false, island = '', pokeId?: number, session = 0): number {
  let rate = Math.max(SHINY_BASE, (context.overrides?.shinyUp ?? shinyUp) ? SHINY_EVENT : 0)
  const pokemon = pokeId === undefined ? undefined : pokeById(pokeId)
  for (const event of activeActivities(context, 240)) {
    const bonuses = event.features?.filter(feature => feature.id === 'shiny-boost' && feature.parameters?.rate !== undefined) ?? []
    // Published snapshots before the numeric declaration still get New Moon UP.
    if (!bonuses.length && event.id.startsWith('new-moon-day-')) rate = Math.max(rate, SHINY_NEW_MOON)
    for (const bonus of bonuses) {
      const { rate: eventRate, pokemonIds } = bonus.parameters!
      if (bonus.islands && !bonus.islands.includes(island)) continue
      if (pokemonIds !== undefined && (!Array.isArray(pokemonIds) || !pokemonIds.includes(pokeId))) continue
      if (typeof eventRate === 'number' && Number.isFinite(eventRate) && eventRate >= 0 && eventRate <= 1) rate = Math.max(rate, eventRate)
    }
    if (hasLegacyShinyUp(event, context, island, pokemon, session)) rate = Math.max(rate, SHINY_EVENT)
  }
  return rate
}

/** RAE 地图页 snorlaxData：每岛 35 档评级的能量门槛，和每条睡姿的最低评级（下标）。 */
const SNORLAX = snorlaxRanks as Record<IslandId, { energy: number[], unlock: Record<string, number> }>

export const RANK_ORDER = (cloneData(sleep_config_extracted0.RANK_ORDER) as unknown as readonly [readonly ["普通",5],readonly ["超级",5],readonly ["高级",5],readonly ["大师",20]])
  .flatMap(([title, n]) => Array.from({ length: n }, (_, i) => `${title}${i + 1}`))

export function rankIndex(rank: string): number {
  const i = RANK_ORDER.indexOf(rank)
  return i < 0 ? 0 : i
}

function rankEnergy(island: IslandId) {
  return (SNORLAX[island] ?? SNORLAX.greengrass).energy
}

export function rankFromStrength(island: IslandId, strength: number): string {
  const energy = rankEnergy(island)
  let index = 0
  energy.forEach((min, i) => {
    if (strength >= min) index = i
  })
  return RANK_ORDER[index]!
}

/** 该岛达到这一档评级需要的最低能量。 */
export function rankStrength(island: IslandId, rank: string): number {
  return rankEnergy(island)[rankIndex(rank)] ?? 0
}

/** 升到下一档评级还差多少能量。已经大师20时没有下一档。 */
export function rankToNext(island: IslandId, strength: number) {
  const index = rankIndex(rankFromStrength(island, strength))
  const min = rankEnergy(island)[index + 1]
  if (min == null) return null
  return { rank: RANK_ORDER[index + 1]!, need: min - Math.max(0, strength) }
}

/** 这条睡姿在该岛需要的最低评级下标。 */
export function styleUnlockRequirement(island: IslandId, style: { pokeId: number, stars: number, styleId?: number, unlockRank?: number }): number | undefined {
  return style.unlockRank ?? SNORLAX[island]?.unlock[styleKey(style.pokeId, style.stars, style.styleId)]
}

export function styleUnlockIndex(island: IslandId, style: Parameters<typeof styleUnlockRequirement>[1]): number {
  return styleUnlockRequirement(island, style) ?? 0
}

function bandsOf(island: IslandId) {
  const meta = islandById(island)
  const key = (meta?.band ?? 'greengrass') as BandKey
  return ENCOUNTER_BANDS[key] ?? ENCOUNTER_BANDS.greengrass
}

export function drowsyPower(score: number, strength: number, event = 1): number {
  return Math.max(0, score) * Math.max(0, strength) * event
}

/** 满睡眠 8 小时 30 分对应 100 分，每分约 5.1 分钟。 */
export function sleepMinutes(score: number): number {
  return Math.round(Math.max(0, score) * sleep_sleepMinutes_ruleParameters.minutesPerScore)
}

export function sleepClock(score: number): string {
  const minutes = sleepMinutes(score)
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours <= 0) return `${rest}分`
  return rest ? `${hours}小时${rest}分` : `${hours}小时`
}

/** 这段睡眠里帮手大约掉的活力，每 10 分钟 1 点。满睡眠 510 分钟为 51。 */
export function energyLost(score: number): number {
  return Math.ceil(sleepMinutes(score) / sleep_energyLost_ruleParameters.minutesPerEnergy)
}

export const EVENT_BONUSES = EVENT_PARAMETERS.sleep.bonuses

/** 再抓到下一只还差多少卡比兽能量。已经到 8 只时没有下一档。 */
export function strengthToNext(island: IslandId, score: number, strength: number, event = 1) {
  if (score <= 0) return null
  const current = encounterCount(island, drowsyPower(score, strength, event))
  if (current >= sleep_strengthToNext_ruleParameters.maxNaturalEncounters) return null
  const total = energyForCount(island, score, event, current + 1)
  const need = total - Math.max(0, strength)
  if (need <= 0) return null
  return { count: current + 1, need }
}

export function encounterCount(island: IslandId, dp: number): number {
  const bands = bandsOf(island)
  let count = sleep_encounterCount_ruleParameters.minNaturalEncounters
  for (const b of bands) {
    if (dp >= b.min) count = b.count
  }
  return count
}

export function energyForCount(island: IslandId, score: number, event: number, count: number): number {
  const bands = bandsOf(island)
  const band = bands.find((b) => b.count === count)
  if (!band || score <= 0) return 0
  return Math.ceil(band.min / (score * event))
}

export function maxEncounters(island: IslandId, score: number, strength: number, event = 1, opts?: { camp?: boolean, incense?: boolean }) {
  const extra = (opts?.camp ? ruleParameters.modules.sleep.maxEncounters.campExtra : 0) + (opts?.incense ? ruleParameters.modules.sleep.maxEncounters.incenseExtra : 0)
  const single = encounterCount(island, drowsyPower(score, strength, event)) + extra
  let best = { total: single, a: score, b: 0, first: single, second: 0 }
  const maxScore = Math.floor(score)
  for (let a = 1; a < maxScore; a++) {
    const b = maxScore - a
    const first = encounterCount(island, drowsyPower(a, strength, event)) + extra
    const second = encounterCount(island, drowsyPower(b, strength, event)) + (opts?.incense ? ruleParameters.modules.sleep.maxEncounters.incenseExtra : 0)
    const total = first + second
    if (total > best.total) best = { total, a, b, first, second }
  }
  const next: Record<number, number> = {}
  for (const n of sleep_config_ruleCatalogs.maxEncountersList0.values) next[n] = energyForCount(island, score, event, n)
  return { single, best, next, extra }
}

/** 一场睡眠里最多一只。平日必须睡姿类型与所选类型一致。 */
export const SPECIAL_POKEMON = new Set(cloneData(sleep_config_extracted0.SPECIAL_POKEMON))

export interface DrawOpts extends ResearchBonuses {
  /** In-process observers for the production draw. Never sent to workers. */
  traceSlot?: (slot: SleepSlotTrace) => void
  observeResearch?: (slots: { pokeId: number, stars: number, styleId?: number, candy: number }[]) => void
  simulationNumber?: number
  seed?: number
  campTicket?: boolean
  activity?: ResearchActivitySelection
  activityResolved?: boolean
  teamPokemonIds?: number[]
  tutorial?: boolean
  measurementStartedAt?: string
  researchedBefore?: number
  /** First/second research is separate from the number of preceding Pokémon. */
  researchSession?: 0 | 1
  researchLimit?: 10 | 11
  firstResearchExtras?: number
  rank?: string
  mode?: 'normal' | 'map'
  discovered?: string[]
  rare?: boolean
  shinyUp?: boolean
  /** Shared only across draws in the same research batch. */
  preparedShinyRates?: Map<number, number>
  /** 活动期间，一部分遭遇可以是其他睡眠类型。 */
  eventMix?: EventMix | boolean
  eventMult?: number
  pokemonUps?: PokemonUps
  rng?: () => number
  pool?: ReturnType<typeof unlockedStyles>
  openPool?: ReturnType<typeof unlockedStyles>
}

export interface DrawnStyle {
  pokeId: number
  name: string
  stars: number
  styleName: string
  dpr: number
  styleId?: number
  rare?: boolean
  shiny?: boolean
  undiscovered?: boolean
}

export interface SleepSlotTrace {
  simulation: number
  seed?: number
  slot: number
  pool: 'typed' | 'open' | 'camp'
  branch: 'weighted' | 'terminal' | 'exhausted' | 'fallback' | 'camp'
  before: number
  after: number
  selectionBudget: number
  eligible: { id: number, pokeId: number, stars: number, styleId?: number, dpr: number }[]
  affordable: number[]
  picked: DrawnStyle
  rngCalls: number
}

export function styleKey(pokeId: number, stars: number, styleId?: number) {
  return styleId == null ? `${pokeId}-${stars}` : `${pokeId}-${stars}-${styleId}`
}

type StyleFace = { pokeId: number, stars: number, styleId?: number, island: string, limited?: boolean }

function faceOf(style: StyleFace) {
  return { stars: style.stars, styleId: style.styleId }
}

const facesByPokemon = new Map<number, { stars: number, styleId?: number }[]>()
const knownStyles = [...SLEEP_STYLES, ...ACTIVITY_CATALOG.activities.flatMap(event => [...(event.spawns ?? []), ...(event.phases ?? []).flatMap(phase => phase.spawns ?? [])])]
for (const style of knownStyles as StyleFace[]) {
  const key = styleKey(style.pokeId, style.stars, style.styleId)
  const faces = facesByPokemon.get(style.pokeId) ?? []
  if (!faces.some((face) => styleKey(style.pokeId, face.stars, face.styleId) === key)) faces.push(faceOf(style))
  facesByPokemon.set(style.pokeId, faces)
}

const starsByPokemon = new Map<number, number[]>()
for (const [pokeId, faces] of facesByPokemon) {
  starsByPokemon.set(pokeId, [...new Set(faces.map((face) => face.stars))].sort((a, b) => a - b))
}

const islandIds = new Set<string>(ISLANDS.map((island) => island.id))
let wallKeys: string[] | null = null

/** 图鉴墙上会出现的睡姿，含进化型。同一条睡姿只记一次；百变怪的多个四星按睡姿 id 分开。 */
export function wallStyleKeys(): string[] {
  if (wallKeys) return wallKeys
  const keys = new Set<string>()
  for (const style of knownStyles as StyleFace[]) {
    if (!islandIds.has(style.island)) continue
    keys.add(styleKey(style.pokeId, style.stars, style.styleId))
  }
  wallKeys = [...keys]
  return wallKeys
}

export interface SleepdexSelection {
  sleepdexMode?: 'all' | 'list'
  sleepdex?: readonly string[]
  sleepdexExcluded?: readonly string[]
}

/** 没手动改过图鉴时，墙上每一张都算已选中。 */
export function resolvedSleepdex(selection: SleepdexSelection): string[] {
  if (selection.sleepdexMode === 'list') return [...(selection.sleepdex ?? [])]
  const excluded = new Set(selection.sleepdexExcluded ?? [])
  return wallStyleKeys().filter((key) => !excluded.has(key))
}

export function sleepdexState(pokeId: number, discovered: readonly string[]) {
  const stars = starsByPokemon.get(pokeId) ?? []
  const faces = facesByPokemon.get(pokeId) ?? []
  const have = new Set(discovered)
  const missing = stars.filter((star) => faces.some((face) => face.stars === star && !have.has(styleKey(pokeId, face.stars, face.styleId))))
  return { stars, missing, complete: stars.length > 0 && missing.length === 0 }
}

/** 该岛 RAE 地图上的睡姿（含进化型），按评级和睡意之力过滤。 */
export function unlockedStyles(island: IslandId, sleepType: SleepType, dp: number, rank: string, mode: 'normal' | 'map', activity?: ResearchActivitySelection) {
  const need = rankIndex(rank)
  const budget = raeSpoBudget(dp)
  return researchSleepStyles(SLEEP_STYLES, researchActivity(activity)).filter((s) => {
    if (s.limited || s.island !== island) return false
    if (mode === 'normal' && sleepType !== '没有特征' && s.sleepType !== sleepType) return false
    if (styleUnlockIndex(island, s) > need) return false
    return raeSpoCost(s.dpr) <= budget
  })
}

export function favoredOnIsland(island: IslandId, berries: string[]) {
  const species = islandById(island)?.species ?? []
  return species
    .map((id) => pokeById(id))
    .filter((p): p is NonNullable<typeof p> => !!p && berries.includes(p.berry))
}

function buildResearchLottery(island: IslandId, sleepType: SleepType, power: number, rank: string, mode: 'normal' | 'map', context: ResearchActivityContext, options: DrawOpts) {
  requireRaeSleepLottery()
  rank = options.rank ?? rank
  mode = options.mode ?? mode
  const naturalSlots = encounterCount(island, power)
  const mixed = sleepType !== '没有特征' && mode !== 'map' ? openSleepSlots(naturalSlots, options.eventMix) : 0
  const session = options.researchSession ?? Number((options.researchedBefore ?? 0) > 0)
  const styles = new Map<RaeSleepCandidate, SleepStyleRow>()
  const makeCandidates = (rows: SleepStyleRow[]) => rows.flatMap(style => {
    const legendary = SPECIAL_POKEMON.has(style.pokeId)
    if (style.limited || !hasResearchDpr(style) || (options.rare === false && legendary)
      || (!context.includeUnreleasedPokemon && context.pendingPokemon?.includes(style.pokeId))) return []
    const internalId = sleepStyleInternalId(style)
    const effect = activityValues(context, island, pokeById(style.pokeId), 240, undefined, session)
    const candidate: RaeSleepCandidate = {
      internalId, unlockRank: styleUnlockIndex(island, style), spo: raeSpoCost(style.dpr),
      weight: sleepEncounterWeight(style.pokeId, effect.encounterModifier, options.pokemonUps),
      belly: style.styleName.includes('大肚'), legendary, leaderExcluded: isLastRollExcluded(style),
      filler: isRaeFiller(island, internalId), target: false, candy: 0,
    }
    styles.set(candidate, style)
    return [candidate]
  })
  const typedPool = makeCandidates(options.pool ?? unlockedStyles(island, sleepType, Infinity, rank, mode, context))
  const mixedPool = mixed ? {
    slots: mixed,
    candidates: makeCandidates(options.openPool ?? unlockedStyles(island, '没有特征', Infinity, rank, 'normal', context)),
  } : undefined
  const query = {
    spo: raeSpoBudget(power), naturalSlots, typedPool, mixedPool,
    restrictedLeaderChance: RAE_RESTRICTED_LEADER_CHANCE, campTicket: options.campTicket,
  }
  return { query, styles }
}

function prepareResearchDraw(island: IslandId, sleepType: SleepType, power: number, rank: string, mode: 'normal' | 'map', context: ResearchActivityContext, options: DrawOpts) {
  const { query, styles } = buildResearchLottery(island, sleepType, power, rank, mode, context, options)
  const { naturalSlots } = query
  const mixed = query.mixedPool?.slots ?? 0
  const session = options.researchSession ?? Number((options.researchedBefore ?? 0) > 0)
  const roll = prepareRaeSleepDraw(query)
  const discovered = new Set(options.discovered)
  const shinyRates = options.preparedShinyRates ?? new Map<number, number>()
  return (rng: () => number, simulation = 1): DrawnStyle[] => {
    const got: DrawnStyle[] = []
    let calls = 0, beforeSlot = 0
    const trace = options.traceSlot
    const random = trace ? () => { calls++; return rng() } : rng
    roll(random, candidate => {
      const style = styles.get(candidate)!
      let rate = shinyRates.get(style.pokeId)
      if (rate === undefined) {
        rate = sleepShinyRate(context, options.shinyUp, island, style.pokeId, session)
        shinyRates.set(style.pokeId, rate)
      }
      got.push({ ...style, rare: candidate.legendary, shiny: random() < rate,
        undiscovered: !discovered.has(styleKey(style.pokeId, style.stars, style.styleId)) })
    }, trace && (detail => {
      const eligible = detail.eligible.map(candidate => styles.get(candidate)!)
      trace({
        simulation, seed: options.seed, slot: detail.slot + 1,
        pool: detail.slot === naturalSlots ? 'camp' : detail.slot < mixed ? 'open' : 'typed',
        branch: detail.stage === 'filler' ? 'exhausted' : detail.stage === 'last' ? 'terminal' : detail.stage === 'regular' ? 'weighted' : 'camp',
        before: detail.before * RAE_SPO_RATE, after: detail.after * RAE_SPO_RATE, selectionBudget: detail.budget * RAE_SPO_RATE,
        eligible: eligible.map(({ id, pokeId, stars, styleId, dpr }) => ({ id, pokeId, stars, styleId, dpr })),
        affordable: eligible.filter(style => raeSpoCost(style.dpr) <= detail.budget).map(style => style.id),
        picked: { ...got[detail.slot]! }, rngCalls: calls - beforeSlot,
      })
      beforeSlot = calls
    }))
    return got
  }
}

export function sleepDraw(
  island: IslandId,
  sleepType: SleepType,
  dp: number,
  rank = '大师1',
  mode: 'normal' | 'map' = 'normal',
  rng: () => number = Math.random,
  opts: DrawOpts = {},
): DrawnStyle[] {
  const resolved = resolveSleepDrawOptions(island, dp, opts)
  const draw = prepareResearchDraw(island, sleepType, resolved.power, rank, mode, resolved.context, resolved.options)
  return draw(rng, opts.simulationNumber)
}

function resolveSleepDrawOptions(island: IslandId, dp: number, opts: DrawOpts) {
  if (!opts.activityResolved) {
    const activity = researchActivity({ ...opts.activity, teamPokemonIds: opts.teamPokemonIds ?? opts.activity?.teamPokemonIds, tutorial: opts.tutorial ?? opts.activity?.tutorial, measurementStartedAt: opts.measurementStartedAt ?? opts.activity?.measurementStartedAt })
    assertActivitySupported(activity, 'research', 240, island, opts.researchSession ?? Number((opts.researchedBefore ?? 0) > 0))
    const effects = activityValues(activity, island, undefined, (sleep_sleepDraw_runtimeParameters.p001 as 240), { drowsyPowerMultiplier: opts.eventMult ?? 1, eventMix: normalizeEventMix(opts.eventMix) }, opts.researchSession ?? Number((opts.researchedBefore ?? 0) > 0))
    if (effects.drowsyPowerMultiplier !== (opts.eventMult ?? 1)) dp = dp / (opts.eventMult ?? 1) * effects.drowsyPowerMultiplier
    opts = { ...opts, activity, activityResolved: true, eventMult: effects.drowsyPowerMultiplier, eventMix: effects.eventMix }
  }
  return { power: dp, context: researchActivity(opts.activity), options: opts }
}

/** Exposes the same fixed input assembled by the single-research simulator. */
export function inspectResearchLottery(island: IslandId, sleepType: SleepType, dp: number, rank: string, opts: DrawOpts = {}) {
  const { power, context, options } = resolveSleepDrawOptions(island, dp, opts)
  return { power, ...buildResearchLottery(island, sleepType, power, rank, 'normal', context, options) }
}

export interface SleepExpectRow { name: string, pokeId: number, stars: number, count: number, shiny: number, rare: number, researchExp: number, shards: number, candy: number }
export interface SleepExpectCheckpoint { completed: number, randomState: number, rows: SleepExpectRow[] }

function researchRewardAtSlot(style: SleepStyleRow, index: number, island: IslandId, activity: ResearchActivityContext, opts: DrawOpts) {
  const base = boostedResearchReward(dailyResearchReward(sleepReward(style), (opts.researchedBefore ?? 0) + index, opts.researchLimit ?? (sleep_sleepExpectSteps_runtimeParameters.p003 as 10)), opts)
  if (!base) return undefined
  const effect = activityValues(activity, island, pokeById(style.pokeId), 240, undefined, opts.researchSession ?? Number((opts.researchedBefore ?? 0) > 0))
  return { researchExp: base.researchExp * effect.researchExpMultiplier, shards: base.shards * effect.dreamShardsMultiplier, candy: base.candy * effect.researchCandyMultiplier }
}

/** Returns the same accumulated row units as sleepExpect, scaled by the display batch size. */
export function sleepTreeExpect(island: IslandId, sleepType: SleepType, dp: number, displayBatch: number, opts: DrawOpts, precision: 'medium' | 'high'): SleepExpectRow[] {
  const { power, context, options } = resolveSleepDrawOptions(island, dp, opts)
  const { query, styles } = buildResearchLottery(island, sleepType, power, opts.rank ?? '大师1', 'normal', context, options)
  const session = options.researchSession ?? Number((options.researchedBefore ?? 0) > 0)
  const counts = new Map<RaeSleepCandidate, number[]>()
  runRaeSleepLottery(query, { precision, statistic: 'expectation', trace: { styleExpectation(candidate, slot, mass) {
    if (mass <= 0) return
    let slots = counts.get(candidate)
    if (!slots) { slots = []; counts.set(candidate, slots) }
    slots[slot] = (slots[slot] ?? 0) + mass
  } } })
  const rows = new Map<string, SleepExpectRow>()
  for (const [candidate, slots] of counts) {
    const style = styles.get(candidate)!
    const key = `${style.pokeId}-${style.stars}-${candidate.legendary ? 'r' : 'n'}`
    const row = rows.get(key) ?? { name: style.name, pokeId: style.pokeId, stars: style.stars, count: 0, shiny: 0, rare: 0, researchExp: 0, shards: 0, candy: 0 }
    const shiny = sleepShinyRate(context, options.shinyUp, island, style.pokeId, session)
    slots.forEach((mass, slot) => {
      const count = mass * displayBatch
      const reward = researchRewardAtSlot(style, slot, island, context, options)
      row.count += count
      row.shiny += count * shiny
      if (candidate.legendary) row.rare += count
      row.researchExp += count * (reward?.researchExp ?? 0)
      row.shards += count * (reward?.shards ?? 0)
      row.candy += count * (reward?.candy ?? 0)
    })
    rows.set(key, row)
  }
  return [...rows.values()].sort((a, b) => b.count - a.count)
}

export function* sleepExpectSteps(
  island: IslandId,
  sleepType: SleepType,
  dp: number,
  n = sleep_sleepExpectSteps_ruleParameters.defaultIterations,
  mode: 'normal' | 'map' = 'normal',
  opts: DrawOpts & { seed?: number } = {},
  onProgress?: (completed: number) => void,
  checkpoint?: SleepExpectCheckpoint,
) {
  const activity = researchActivity({ ...opts.activity, teamPokemonIds: opts.teamPokemonIds ?? opts.activity?.teamPokemonIds, tutorial: opts.tutorial ?? opts.activity?.tutorial, measurementStartedAt: opts.measurementStartedAt ?? opts.activity?.measurementStartedAt })
  assertActivitySupported(activity, 'research', 240, island, opts.researchSession ?? 0)
  const effects = activityValues(activity, island, undefined, (sleep_sleepExpectSteps_runtimeParameters.p001 as 240), { drowsyPowerMultiplier: opts.eventMult ?? 1, eventMix: normalizeEventMix(opts.eventMix) }, opts.researchSession ?? Number((opts.researchedBefore ?? 0) > 0))
  if (effects.drowsyPowerMultiplier !== (opts.eventMult ?? 1)) dp = dp / (opts.eventMult ?? 1) * effects.drowsyPowerMultiplier
  opts = { ...opts, activity, activityResolved: true, eventMult: effects.drowsyPowerMultiplier, eventMix: effects.eventMix }
  const freq = new Map<string, { name: string, pokeId: number, stars: number, count: number, shiny: number, rare: number, researchExp: number, shards: number, candy: number }>()
  for (const row of checkpoint?.rows ?? []) freq.set(`${row.pokeId}-${row.stars}-${row.rare ? 'r' : 'n'}`, { ...row })
  const rank = opts.rank ?? '大师1'
  const drawResearch = prepareResearchDraw(island, sleepType, dp, rank, mode, activity, opts)
  const random = createSleepRandom(checkpoint?.randomState ?? opts.seed ?? 0)
  for (let i = checkpoint?.completed ?? 0; i < n; i++) {
    const draw = drawResearch(random.next, i + 1)
    const observed = opts.observeResearch ? [] as Parameters<NonNullable<DrawOpts['observeResearch']>>[0] : undefined
    for (const [index, s] of draw.entries()) {
      const key = `${s.pokeId}-${s.stars}-${s.rare ? 'r' : 'n'}`
      const cur = freq.get(key) ?? { name: s.name, pokeId: s.pokeId, stars: s.stars, count: 0, shiny: 0, rare: 0, researchExp: 0, shards: 0, candy: 0 }
      const reward = researchRewardAtSlot(s, index, island, activity, opts)
      cur.count += 1
      cur.researchExp += reward?.researchExp ?? 0
      cur.shards += reward?.shards ?? 0
      cur.candy += reward?.candy ?? 0
      observed?.push({ pokeId: s.pokeId, stars: s.stars, styleId: s.styleId, candy: reward?.candy ?? 0 })
      if (s.shiny) cur.shiny += 1
      if (s.rare) cur.rare += 1
      freq.set(key, cur)
    }
    if (observed) opts.observeResearch!(observed)
    // Bound message traffic to one update per 100 simulations.
    if ((i + 1) % 100 === 0 || i + 1 === n) {
      onProgress?.(i + 1)
      yield { completed: i + 1, randomState: random.state, rows: [...freq.values()].map((row) => ({ ...row })) }
    }
  }
  return [...freq.values()].sort((a, b) => b.count - a.count)
}

export function sleepExpect(island: IslandId, sleepType: SleepType, dp: number, n = sleep_sleepExpect_ruleParameters.defaultIterations, mode: 'normal' | 'map' = 'normal', opts: DrawOpts & { seed?: number } = {}, onProgress?: (completed: number) => void) {
  const steps = sleepExpectSteps(island, sleepType, dp, n, mode, opts, onProgress)
  let next = steps.next()
  while (!next.done) next = steps.next()
  return next.value
}

/** 当前睡意之力相对下一档睡姿需求的覆盖比例。池子里的睡姿都已解锁时为 1。 */
export function effectiveDrowsyRatio(dp: number, dprs: number[]): number {
  if (dp <= 0) return 0
  let next = Infinity
  for (const dpr of dprs) {
    if (dpr > dp && dpr < next) next = dpr
  }
  return Number.isFinite(next) ? dp / next : 1
}

export function expectSpecies(rows: { pokeId: number, name: string, count: number }[]) {
  const total = rows.reduce((sum, row) => sum + row.count, 0)
  const byId = new Map<number, { pokeId: number, name: string, count: number }>()
  for (const row of rows) {
    const cur = byId.get(row.pokeId) ?? { pokeId: row.pokeId, name: row.name, count: 0 }
    cur.count += row.count
    byId.set(row.pokeId, cur)
  }
  return [...byId.values()]
    .map((row) => ({
      pokeId: row.pokeId,
      name: row.name,
      count: row.count,
      percent: total ? (row.count / total) * 100 : 0,
    }))
    .sort((a, b) => b.percent - a.percent || a.pokeId - b.pokeId)
}

export function shinyRateLabel(up: boolean) {
  return `${((up ? SHINY_EVENT : SHINY_BASE) * 100).toFixed(2)}%`
}
