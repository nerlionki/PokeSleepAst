import resourceMeta from '../data/meta.resource'
import type { ActivityAnnouncement, ActivityArchive } from '../resources/activityArchive'
import type { ActivityExchange, ExchangeOffer } from '../resources/activityExchange'
import { localActivityDate, offsetActivityDate } from './activities'
import { bundleItem, bundlesForActivity, type EventBundle, type EventBundleCatalog } from './eventBundles'

export interface ExchangeShop {
  key: string
  event: ActivityAnnouncement
  exchange: ActivityExchange
}

export interface ExchangePlan {
  owned: number
  researchDays: number
  researchPerDay: number
  other: number
  offers: Record<string, number>
  bundles: Record<string, number>
  rewards: Record<string, boolean>
}

export function emptyExchangePlan(): ExchangePlan {
  return { owned: 0, researchDays: 0, researchPerDay: 0, other: 0, offers: {}, bundles: {}, rewards: {} }
}

export function shopsForEvent(event?: ActivityAnnouncement): ExchangeShop[] {
  if (!event) return []
  return [...(event.exchange ? [event.exchange] : []), ...event.exchanges ?? []]
    .map(exchange => ({ key: event.id + '/' + exchange.currencyItemId, event, exchange }))
}

export function exchangeCatalog(): ExchangeShop[] {
  const { activityArchive } = resourceMeta as { activityArchive?: ActivityArchive }
  return activityArchive?.events.flatMap(shopsForEvent) ?? []
}

export function exchangeOpensAt(shop: ExchangeShop): number {
  return Date.parse(shop.exchange.opensAt ?? '')
}

export function exchangeClosesAt(shop: ExchangeShop): number {
  return Date.parse(shop.exchange.closesAt ?? '')
}

export function isExchangeOpen(shop: ExchangeShop, now: number): boolean {
  return exchangeOpensAt(shop) <= now && now < exchangeClosesAt(shop)
}

export function exchangePlanShops(shops: ExchangeShop[], now: number, trial: boolean): ExchangeShop[] {
  const open = shops.filter(shop => isExchangeOpen(shop, now))
  if (!trial) return open
  const preview = shops.filter(shop => !isExchangeOpen(shop, now))
    .sort((a, b) => b.event.startsOn.localeCompare(a.event.startsOn))
  return [...open, ...preview.map(shop => {
    if (shop.exchange.offers.every(offer => offer.id)) return shop
    // Preserve plan keys when an older snapshot later receives its dated batches.
    const occurrences = new Map<string, number>()
    const offers = shop.exchange.offers.map(offer => {
      const batch = String(offer.itemId).toLowerCase() + '-w' + offer.week
      const ordinal = (occurrences.get(batch) ?? 0) + 1
      occurrences.set(batch, ordinal)
      return { ...offer, id: offer.id ?? batch + '-' + ordinal }
    })
    return { ...shop, exchange: { ...shop.exchange, offers } }
  })]
}

function researchStartsAt(shop: ExchangeShop): number {
  return Date.parse(shop.event.startsOn + 'T04:00:00')
}

export function exchangePlanTime(shop: ExchangeShop, now: number): number {
  return isExchangeOpen(shop, now) ? now : researchStartsAt(shop)
}

export function groupExchangeOffers(offers: readonly ExchangeOffer[]) {
  const groups = new Map<string, { key: string; offers: ExchangeOffer[] }>()
  for (const offer of offers) {
    const key = offer.seedPokemonId ? offer.itemId + '/' + offer.seedPokemonId : String(offer.itemId)
    const current = groups.get(key) ?? { key, offers: [] }
    current.offers.push(offer)
    groups.set(key, current)
  }
  return [...groups.values()]
}

export function exchangeQuantity(value: number | string | undefined, limit = 999_999_999): number {
  const number = Number(value)
  return Number.isFinite(number) ? Math.min(limit, Math.max(0, Math.floor(number))) : 0
}

export function exchangeBundleOpensAt(bundle: EventBundle): number {
  const starts = bundle.saleStartsAt
  return starts ? Date.parse(starts.includes('T') ? starts : starts + 'T00:00:00') : NaN
}

function datedBundleEnd(bundle: EventBundle): number {
  const ends = bundle.saleEndsAt
  if (!ends) return NaN
  // Bundle announcements record the last sale minute, or an inclusive date.
  return ends.includes('T') ? Date.parse(ends) + 60_000 : Date.parse(offsetActivityDate(ends, 1) + 'T00:00:00')
}

export function exchangeBundles(shop: ExchangeShop, catalog: EventBundleCatalog | null, now: number) {
  if (!catalog) return []
  return bundlesForActivity(catalog, shop.event).flatMap(bundle => {
    const starts = exchangeBundleOpensAt(bundle)
    const opens = shop.exchange.opensAt ? exchangeOpensAt(shop) : researchStartsAt(shop)
    const closes = shop.exchange.closesAt ? exchangeClosesAt(shop) : Infinity
    if (!bundle.saleStartsAt || !(Math.max(now, opens) < datedBundleEnd(bundle) && starts < closes)) return []
    const quantity = bundle.items.reduce((sum, item) => {
      const itemId = item.itemId ?? bundleItem(item)?.id
      return itemId === shop.exchange.currencyItemId ? sum + item.quantity : sum
    }, 0)
    return quantity > 0 ? [{ bundle, quantity }] : []
  })
}

export function exchangeRewards(shop: ExchangeShop, now: number) {
  return (shop.exchange.rewardGroups ?? []).filter(group => now < Date.parse(group.closesAt))
}

export function exchangeResearchDays(shop: ExchangeShop, now: number): number {
  const closes = shop.exchange.researchClosesAt ?? shop.event.endsOn + 'T04:00:00'
  if (now >= Date.parse(closes)) return 0
  const first = localActivityDate(new Date(Math.max(researchStartsAt(shop), now)))
  const last = localActivityDate(new Date(Date.parse(closes) - 1))
  return Math.max(0, (Date.parse(last) - Date.parse(first)) / 86_400_000 + 1)
}

export function exchangeClockBoundaries(shops: ExchangeShop[], catalog: EventBundleCatalog | null): number[] {
  return shops.flatMap(shop => [
    exchangeOpensAt(shop), exchangeClosesAt(shop), Date.parse(shop.exchange.researchClosesAt ?? ''),
    ...shop.exchange.offers.map(offer => Date.parse(offer.opensAt ?? '')),
    ...(shop.exchange.rewardGroups ?? []).flatMap(group => [Date.parse(group.opensAt), Date.parse(group.closesAt)]),
    ...exchangeBundles(shop, catalog, -Infinity).flatMap(({ bundle }) => [exchangeBundleOpensAt(bundle), datedBundleEnd(bundle)]),
  ]).filter(Number.isFinite)
}

export function calculateExchangePlan(shop: ExchangeShop, plan: ExchangePlan, catalog: EventBundleCatalog | null, now: number) {
  const offers = shop.exchange.offers.reduce((sum, offer) =>
    sum + (offer.id ? exchangeQuantity(plan.offers[offer.id], offer.limit) * offer.cost : 0), 0)
  let bundleIncome = 0
  let diamonds = 0
  for (const { bundle, quantity } of exchangeBundles(shop, catalog, now)) {
    const selected = exchangeQuantity(plan.bundles[bundle.id], bundle.purchaseLimit)
    bundleIncome += selected * quantity
    if (bundle.price.unit === '钻石') diamonds += selected * bundle.price.amount
  }
  const rewardIncome = exchangeRewards(shop, now).reduce((sum, group) =>
    sum + group.rewards.reduce((total, reward) => total + (plan.rewards[reward.id] ? reward.quantity : 0), 0), 0)
  const research = exchangeQuantity(plan.researchDays, exchangeResearchDays(shop, now)) * exchangeQuantity(plan.researchPerDay)
  const income = exchangeQuantity(plan.owned) + exchangeQuantity(plan.other) + research + bundleIncome + rewardIncome
  return { income, spent: offers, remaining: income - offers, research, bundleIncome, rewardIncome, diamonds }
}
