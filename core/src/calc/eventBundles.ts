import { activeSnapshot } from '../resources/runtime'
import type { Activity } from './activities'
import { ITEM_CATALOG, itemById, type PokemonItemId } from './itemCatalog'
import { foldText, textHit } from './text'

export interface BundleValuation {
  schemaVersion: 1
  biscuitDiamonds: number
  totalDiamonds: number
  biscuits: string | null
  total: string | null
  excluded: string[]
}
export interface EventBundleItem {
  name: string
  quantity: number
  itemId?: number
  pokemonItemId?: PokemonItemId
  unmapped?: true
  pokemonIncense?: { pokemonId: number; typeId: number }
  pokemonSeedId?: number
}
export interface EventBundle {
  id: string
  name: string
  eventName: string
  eventId?: string
  announcedOn: string | null
  eventEndsOn: string
  saleStartsAt: string | null
  saleEndsAt: string | null
  price: { amount: number; unit: string }
  purchaseLimit: number
  valuation?: BundleValuation
  items: EventBundleItem[]
  sources: { kind: 'official' | 'rae' | 'wiki'; url: string }[]
}
export interface EventBundleCatalog { schemaVersion: 1; bundles: EventBundle[] }

/** Only the downloaded SleepAstCore snapshot contains bundle content. */
export function eventBundleCatalog(includeArchive = false): EventBundleCatalog | null {
  const meta = activeSnapshot()?.data['meta.json'] as { eventBundles?: unknown; archivedEventBundles?: unknown } | undefined
  if (meta?.eventBundles == null) return null
  const catalog = parseEventBundles(meta.eventBundles)
  if (!includeArchive || meta.archivedEventBundles == null) return catalog
  return { ...catalog, bundles: [...catalog.bundles, ...parseEventBundles(meta.archivedEventBundles, true).bundles] }
}
export function parseEventBundles(value: unknown, archive = false): EventBundleCatalog {
  const data = value as EventBundleCatalog | null
  const date = (value: string) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
  const text = (value: unknown) => typeof value === 'string' && value.trim().length > 0
  const dateTime = (value: string) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(value) && Number.isFinite(Date.parse(value))
  const officialSourceUrl = (url: string) => {
    if (/^https:\/\/www\.pokemonsleep\.net\//.test(url)) return true
    const wrapped = url.match(/^https:\/\/web\.archive\.org\/web\/\d+(?:id_)?\/(https:\/\/www\.pokemonsleep\.net\/.*)$/)
    return wrapped != null && /^https:\/\/www\.pokemonsleep\.net\//.test(wrapped[1])
  }
  const ids = new Set<string>()
  if (!data || data.schemaVersion !== 1 || !Array.isArray(data.bundles) || !data.bundles.every(row => {
    if (!row || !text(row.id) || ids.has(row.id)) return false
    ids.add(row.id)
    return text(row.name) && text(row.eventName) && (!archive || text(row.eventId)) && date(row.eventEndsOn)
      && (archive && row.announcedOn === null || row.announcedOn !== null && date(row.announcedOn) && row.announcedOn <= row.eventEndsOn)
      && (archive && row.saleStartsAt === null && row.saleEndsAt === null
        || archive && typeof row.saleStartsAt === 'string' && typeof row.saleEndsAt === 'string' && date(row.saleStartsAt) && date(row.saleEndsAt) && row.saleStartsAt <= row.saleEndsAt
        || typeof row.saleStartsAt === 'string' && typeof row.saleEndsAt === 'string' && dateTime(row.saleStartsAt) && dateTime(row.saleEndsAt) && row.saleStartsAt < row.saleEndsAt)
      && row.price && text(row.price.unit) && Number.isSafeInteger(row.price.amount) && row.price.amount >= 0 && Number.isSafeInteger(row.purchaseLimit) && row.purchaseLimit > 0
      && Array.isArray(row.items) && row.items.length > 0 && row.items.every(item => item && text(item.name) && Number.isSafeInteger(item.quantity) && item.quantity > 0
        && (item.itemId === undefined || Number.isSafeInteger(item.itemId) && item.itemId > 0)
        && (item.pokemonItemId === undefined || item.itemId === undefined && typeof item.pokemonItemId === 'string'
          && /^(?:Candy|Incense)-[1-9]\d*$/.test(item.pokemonItemId))
        && (item.unmapped === undefined || item.unmapped === true && item.itemId === undefined && item.pokemonItemId === undefined)
        && (item.pokemonSeedId === undefined || Number.isSafeInteger(item.pokemonSeedId) && item.pokemonSeedId > 0
          && item.itemId === undefined && item.pokemonItemId === undefined && item.pokemonIncense === undefined)
        && (item.pokemonIncense === undefined || !!item.pokemonIncense && item.itemId === undefined
          && Number.isSafeInteger(item.pokemonIncense.pokemonId) && item.pokemonIncense.pokemonId > 0
          && Number.isSafeInteger(item.pokemonIncense.typeId) && item.pokemonIncense.typeId >= 1 && item.pokemonIncense.typeId <= 18))
      && (row.valuation === undefined || validBundleValuation(row.valuation, row.items.map(item => item.name)))
      && Array.isArray(row.sources) && row.sources.length > 0 && row.sources.every(source => source && typeof source.url === 'string'
        && (source.kind === 'official' && officialSourceUrl(source.url)
          || source.kind === 'rae' && /^https:\/\/pks\.raenonx\.cc\//.test(source.url)
          || archive && source.kind === 'wiki' && /^https:\/\/bulbapedia\.bulbagarden\.net\/wiki\//.test(source.url)))
  })) throw Error('活动礼包资料格式无效，请更新资料后重试')
  return data
}
export function bundleItem(item: EventBundleItem) {
  if (item.unmapped) return undefined
  const id = item.pokemonItemId ?? item.itemId
  if (id !== undefined) return itemById(id)
  // Existing online snapshots can omit an ID. Resolve only unambiguous legacy aliases.
  const name = foldText(item.name)
  const matches = ITEM_CATALOG.filter(row => [row.name, ...(row.aliases ?? [])].some(alias => foldText(alias) === name))
  return matches.length === 1 ? matches[0] : undefined
}
export function calendarDate(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}
/** Calendar-day display window is intentionally separate from sales/game-day times. */
export function visibleEventBundles(catalog: EventBundleCatalog, now: Date, query = ''): EventBundle[] {
  const day = calendarDate(now)
  return catalog.bundles.filter(row => row.announcedOn !== null && row.announcedOn <= day && day <= row.eventEndsOn
    && textHit([row.name, row.eventName, ...row.items.map(item => item.name)].join(' '), query))
    // Preserve SleepAstCore's editorial order within the same announcement day
    // (S, M, L, then training bundles); price is not a display-order criterion.
    .sort((a, b) => (b.announcedOn ?? '').localeCompare(a.announcedOn ?? ''))
}

export function bundlesForActivity(catalog: EventBundleCatalog, event: Activity): EventBundle[] {
  const name = foldText(event.name)
  return catalog.bundles.filter(bundle =>
    bundle.eventId ? bundle.eventId === event.id
      : foldText(bundle.eventName) === name && bundle.announcedOn !== null
        && bundle.announcedOn < event.endsOn && bundle.eventEndsOn >= event.startsOn,
  )
}

/** Validate display fields without recalculating their server-owned meaning. */
function validBundleValuation(value: BundleValuation, names: string[]): boolean {
  const ratio = (x: unknown) => x === null || typeof x === 'string' && /^\d+\.\d{2}$/.test(x)
  return !!value && value.schemaVersion === 1 && Number.isFinite(value.biscuitDiamonds) && value.biscuitDiamonds >= 0
    && Number.isFinite(value.totalDiamonds) && value.totalDiamonds >= value.biscuitDiamonds
    && ratio(value.biscuits) && ratio(value.total) && Array.isArray(value.excluded)
    && value.excluded.every(name => typeof name === 'string' && names.includes(name))
}
