import { normalizeEventMix, openSleepSlots, pokemonSleepWeight, type EventMix, type PokemonUps } from './sleepRules'
import { selectSleepStyle } from './sleepSelection'
import { foldText } from './text'
import snorlaxRanks from '../data/snorlax-ranks.json'
import type { IslandId, SleepType } from '../types'
import { ENCOUNTER_BANDS, FALLBACKS, ISLANDS, islandById, POKEDEX, pokeById, SLEEP_STYLES, type SleepStyleRow } from './data'
import { sleepReward, sleepStyleInternalId } from './sleepRewards'

type BandKey = keyof typeof ENCOUNTER_BANDS

export const SHINY_BASE = 3 / 1000
export const SHINY_EVENT = 3 / 40
export const UNDISCOVERED_WEIGHT = 2

/** RAE 地图页 snorlaxData：每岛 35 档评级的能量门槛，和每条睡姿的最低评级（下标）。 */
const SNORLAX = snorlaxRanks as Record<IslandId, { energy: number[], unlock: Record<string, number> }>

export const RANK_ORDER = ([['普通', 5], ['超级', 5], ['高级', 5], ['大师', 20]] as const)
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
export function styleUnlockIndex(island: IslandId, style: { pokeId: number, stars: number, styleId?: number }): number {
  return SNORLAX[island]?.unlock[styleKey(style.pokeId, style.stars, style.styleId)] ?? 0
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
  return Math.round(Math.max(0, score) * 5.1)
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
  return Math.ceil(sleepMinutes(score) / 10)
}

export const EVENT_BONUSES = [
  { mult: 1, label: '平时' },
  { mult: 1.1, label: '1.1倍' },
  { mult: 1.3, label: '1.3倍' },
  { mult: 1.5, label: '好眠日*1.5倍' },
  { mult: 2, label: '满月日*2倍' },
  { mult: 2.5, label: '满月日*2.5倍(周三)' },
  { mult: 3, label: '满月日*3倍(周二)' },
  { mult: 4, label: '满月日*4倍(周一)' },
] as const

/** 再抓到下一只还差多少卡比兽能量。已经到 8 只时没有下一档。 */
export function strengthToNext(island: IslandId, score: number, strength: number, event = 1) {
  if (score <= 0) return null
  const current = encounterCount(island, drowsyPower(score, strength, event))
  if (current >= 8) return null
  const total = energyForCount(island, score, event, current + 1)
  const need = total - Math.max(0, strength)
  if (need <= 0) return null
  return { count: current + 1, need }
}

export function encounterCount(island: IslandId, dp: number): number {
  const bands = bandsOf(island)
  let count = 3
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
  const extra = (opts?.camp ? 1 : 0) + (opts?.incense ? 1 : 0)
  const single = encounterCount(island, drowsyPower(score, strength, event)) + extra
  let best = { total: single, a: score, b: 0, first: single, second: 0 }
  const maxScore = Math.floor(score)
  for (let a = 1; a < maxScore; a++) {
    const b = maxScore - a
    const first = encounterCount(island, drowsyPower(a, strength, event)) + extra
    const second = encounterCount(island, drowsyPower(b, strength, event)) + (opts?.incense ? 1 : 0)
    const total = first + second
    if (total > best.total) best = { total, a, b, first, second }
  }
  const next: Record<number, number> = {}
  for (const n of [4, 5, 6, 7, 8]) next[n] = energyForCount(island, score, event, n)
  return { single, best, next, extra }
}

/** Wiki 少量跨类型：末尾 floor(n × 0.4) 只固定同类型。 */
export const EVENT_OTHER_SHARE = 0.4

/** 一场睡眠里最多一只。平日必须睡姿类型与所选类型一致。 */
export const SPECIAL_POKEMON = new Set([243, 244, 245, 488, 380, 381, 150])

type PreparedStyle = SleepStyleRow & { order: number, unlockRank: number }
function prepareStyles(island: IslandId, pool: SleepStyleRow[]): PreparedStyle[] {
  return pool.map(style => ({ ...style, order: sleepStyleInternalId(style), unlockRank: styleUnlockIndex(island, style) }))
}

export interface DrawOpts {
  /** Reused immutable metadata during a simulation batch. */
  preparedPool?: PreparedStyle[]
  preparedOpenPool?: PreparedStyle[]
  rank?: string
  mode?: 'normal' | 'map'
  discovered?: string[]
  undiscoveredBoost?: boolean
  rare?: boolean
  shinyUp?: boolean
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

export function styleKey(pokeId: number, stars: number, styleId?: number) {
  return styleId == null ? `${pokeId}-${stars}` : `${pokeId}-${stars}-${styleId}`
}

type StyleFace = { pokeId: number, stars: number, styleId?: number, island: string, limited?: boolean }

function faceOf(style: StyleFace) {
  return { stars: style.stars, styleId: style.styleId }
}

const facesByPokemon = new Map<number, { stars: number, styleId?: number }[]>()
for (const style of SLEEP_STYLES as StyleFace[]) {
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
  for (const style of SLEEP_STYLES as StyleFace[]) {
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
export function unlockedStyles(island: IslandId, sleepType: SleepType, dp: number, rank: string, mode: 'normal' | 'map') {
  const need = rankIndex(rank)
  return SLEEP_STYLES.filter((s) => {
    if (s.limited || s.island !== island) return false
    if (mode === 'normal' && sleepType !== '没有特征' && s.sleepType !== sleepType) return false
    if (styleUnlockIndex(island, s) > need) return false
    return s.dpr <= Math.max(0, dp)
  })
}

export function favoredOnIsland(island: IslandId, berries: string[]) {
  const species = islandById(island)?.species ?? []
  return species
    .map((id) => pokeById(id))
    .filter((p): p is NonNullable<typeof p> => !!p && berries.includes(p.berry))
}

export function fallbackStyle(island: IslandId, sleepType: SleepType): DrawnStyle {
  const allowed = islandById(island)?.species ?? []
  const species = new Set(allowed)
  const fb = FALLBACKS[island] as Record<string, string> | undefined
  const key = sleepType === '没有特征' ? 'balanced'
    : sleepType === '淺淺入夢' ? 'dozing'
      : sleepType === '安然入睡' ? 'snoozing'
        : 'slumbering'
  const named = POKEDEX.find((poke) => foldText(poke.name) === foldText(fb?.[key] ?? '') && species.has(poke.id))
  const poke = named ?? pokeById(allowed[0] ?? 0)
  return {
    pokeId: poke?.id ?? 0,
    name: poke?.name ?? '未知',
    stars: 1,
    styleName: '保底睡姿',
    dpr: 0,
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
  const n = encounterCount(island, dp)
  const discovered = new Set(opts.discovered ?? [])
  const boost = opts.undiscoveredBoost ?? true
  const shinyRate = opts.shinyUp ? SHINY_EVENT : SHINY_BASE
  const allowRare = opts.rare ?? true
  const eventMix = normalizeEventMix(opts.eventMix) !== 'off' && sleepType !== '没有特征' && (opts.mode ?? mode) !== 'map'
  const typed = [...(opts.preparedPool ?? prepareStyles(island, opts.pool ?? unlockedStyles(island, sleepType, Infinity, opts.rank ?? rank, opts.mode ?? mode)))]
  const open = eventMix
    ? [...(opts.preparedOpenPool ?? prepareStyles(island, opts.openPool ?? unlockedStyles(island, '没有特征', Infinity, opts.rank ?? rank, 'normal')))]
    : typed
  const otherSlots = eventMix ? openSleepSlots(n, opts.eventMix) : 0
  const pools = [...new Set([typed, open])]
  const got: DrawnStyle[] = []
  let specialGot = false
  let bellyGot = false
  let remaining = Math.max(0, dp)

  const strip = (match: (pokeId: number, styleId: number) => boolean) => {
    for (const list of pools) {
      for (let i = list.length - 1; i >= 0; i--) {
        if (match(list[i].pokeId, list[i].id)) list.splice(i, 1)
      }
    }
  }

  if (!allowRare) strip((pokeId) => SPECIAL_POKEMON.has(pokeId))

  for (let i = 0; i < n; i++) {
    const src = i < otherSlots ? open : typed
    const usable = src.filter((style) => (!specialGot || !SPECIAL_POKEMON.has(style.pokeId))
      && (!bellyGot || !style.styleName.includes('大肚')))
    let picked: DrawnStyle | undefined
    const item = selectSleepStyle(usable, remaining, i === n - 1, rng, (s) => {
      const missing = boost && !discovered.has(styleKey(s.pokeId, s.stars, s.styleId))
      return (missing ? UNDISCOVERED_WEIGHT : 1) * pokemonSleepWeight(s.pokeId, opts.eventMult, opts.pokemonUps)
    })
    if (item) {
      const missing = boost && !discovered.has(styleKey(item.pokeId, item.stars, item.styleId))
      const rare = SPECIAL_POKEMON.has(item.pokeId)
      picked = { ...item, undiscovered: missing, rare }
      if (rare) specialGot = true
      if (item.styleName.includes('大肚')) bellyGot = true
      remaining = Math.max(0, remaining - item.dpr)
    }
    if (!picked) picked = fallbackStyle(island, i < otherSlots ? '没有特征' : sleepType)
    picked.shiny = rng() < shinyRate
    got.push(picked)
  }
  return got
}

export interface SleepExpectRow { name: string, pokeId: number, stars: number, count: number, shiny: number, rare: number, researchExp: number, shards: number, candy: number }
export interface SleepExpectCheckpoint { completed: number, randomState: number, rows: SleepExpectRow[] }
export function* sleepExpectSteps(
  island: IslandId,
  sleepType: SleepType,
  dp: number,
  n = 4000,
  mode: 'normal' | 'map' = 'normal',
  opts: DrawOpts & { seed?: number } = {},
  onProgress?: (completed: number) => void,
  checkpoint?: SleepExpectCheckpoint,
) {
  const freq = new Map<string, { name: string, pokeId: number, stars: number, count: number, shiny: number, rare: number, researchExp: number, shards: number, candy: number }>()
  for (const row of checkpoint?.rows ?? []) freq.set(`${row.pokeId}-${row.stars}-${row.rare ? 'r' : 'n'}`, { ...row })
  const rank = opts.rank ?? '大师1'
  const pool = unlockedStyles(island, sleepType, Infinity, rank, mode)
  const openPool = normalizeEventMix(opts.eventMix) !== 'off' ? unlockedStyles(island, '没有特征', Infinity, rank, 'normal') : pool
  const preparedPool = prepareStyles(island, pool)
  const preparedOpenPool = openPool === pool ? preparedPool : prepareStyles(island, openPool)
  let randomState = (checkpoint?.randomState ?? opts.seed ?? 0) >>> 0
  const rng = () => {
    randomState = (randomState + 0x6D2B79F5) >>> 0
    let x = randomState
    x = Math.imul(x ^ (x >>> 15), x | 1)
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61)
    return ((x ^ (x >>> 14)) >>> 0) / 0x100000000
  }
  for (let i = checkpoint?.completed ?? 0; i < n; i++) {
    const draw = sleepDraw(island, sleepType, dp, rank, mode, rng, { ...opts, pool, openPool, preparedPool, preparedOpenPool })
    for (const s of draw) {
      const key = `${s.pokeId}-${s.stars}-${s.rare ? 'r' : 'n'}`
      const cur = freq.get(key) ?? { name: s.name, pokeId: s.pokeId, stars: s.stars, count: 0, shiny: 0, rare: 0, researchExp: 0, shards: 0, candy: 0 }
      const reward = sleepReward(s)
      cur.count += 1
      cur.researchExp += reward?.researchExp ?? 0
      cur.shards += reward?.shards ?? 0
      cur.candy += reward?.candy ?? 0
      if (s.shiny) cur.shiny += 1
      if (s.rare) cur.rare += 1
      freq.set(key, cur)
    }
    // Bound message traffic to one update per 100 simulations.
    if ((i + 1) % 100 === 0 || i + 1 === n) {
      onProgress?.(i + 1)
      yield { completed: i + 1, randomState, rows: [...freq.values()].map((row) => ({ ...row })) }
    }
  }
  return [...freq.values()].sort((a, b) => b.count - a.count)
}

export function sleepExpect(island: IslandId, sleepType: SleepType, dp: number, n = 4000, mode: 'normal' | 'map' = 'normal', opts: DrawOpts & { seed?: number } = {}, onProgress?: (completed: number) => void) {
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
  return up ? '活动 3/40（Serebii 分母）' : '基础 3/1000（Serebii 硬编码 3/1000）'
}
