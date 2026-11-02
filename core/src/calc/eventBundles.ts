import { activeSnapshot } from '../resources/runtime'
import { textHit } from './text'

export interface EventBundle {
  id: string
  name: string
  eventName: string
  announcedOn: string
  eventEndsOn: string
  saleStartsAt: string
  saleEndsAt: string
  price: { amount: number; unit: string }
  purchaseLimit: number
  items: { name: string; quantity: number }[]
  sources: { kind: 'official' | 'rae'; url: string }[]
}
export interface EventBundleCatalog { schemaVersion: 1; bundles: EventBundle[] }

/** Only the downloaded SleepAstCore snapshot contains bundle content. */
export function eventBundleCatalog(): EventBundleCatalog | null {
  const meta = activeSnapshot()?.data['meta.json'] as { eventBundles?: unknown } | undefined
  if (meta?.eventBundles == null) return null
  return parseEventBundles(meta.eventBundles)
}
export function parseEventBundles(value: unknown): EventBundleCatalog {
  const data = value as EventBundleCatalog | null
  const date = (value: string) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
  const text = (value: unknown) => typeof value === 'string' && value.trim().length > 0
  const ids = new Set<string>()
  if (!data || data.schemaVersion !== 1 || !Array.isArray(data.bundles) || !data.bundles.every(row => {
    if (!row || !text(row.id) || ids.has(row.id)) return false
    ids.add(row.id)
    return text(row.name) && text(row.eventName) && date(row.announcedOn) && date(row.eventEndsOn) && row.announcedOn <= row.eventEndsOn
      && text(row.saleStartsAt) && text(row.saleEndsAt) && Number.isFinite(Date.parse(row.saleStartsAt)) && Date.parse(row.saleStartsAt) < Date.parse(row.saleEndsAt)
      && row.price && text(row.price.unit) && Number.isSafeInteger(row.price.amount) && row.price.amount >= 0 && Number.isSafeInteger(row.purchaseLimit) && row.purchaseLimit > 0
      && Array.isArray(row.items) && row.items.length > 0 && row.items.every(item => item && text(item.name) && Number.isSafeInteger(item.quantity) && item.quantity > 0)
      && Array.isArray(row.sources) && row.sources.length > 0 && row.sources.every(source => source && typeof source.url === 'string' && (source.kind === 'official' ? /^https:\/\/www\.pokemonsleep\.net\// : source.kind === 'rae' ? /^https:\/\/pks\.raenonx\.cc\// : /$^/).test(source.url))
  })) throw Error('活动礼包资料格式无效，请更新资料后重试')
  return data
}
export function calendarDate(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}
/** Calendar-day display window is intentionally separate from sales/game-day times. */
export function visibleEventBundles(catalog: EventBundleCatalog, now: Date, query = ''): EventBundle[] {
  const day = calendarDate(now)
  return catalog.bundles.filter(row => row.announcedOn <= day && day <= row.eventEndsOn
    && textHit([row.name, row.eventName, ...row.items.map(item => item.name)].join(' '), query))
    // Preserve SleepAstCore's editorial order within the same announcement day
    // (S, M, L, then training bundles); price is not a display-order criterion.
    .sort((a, b) => b.announcedOn.localeCompare(a.announcedOn))
}
