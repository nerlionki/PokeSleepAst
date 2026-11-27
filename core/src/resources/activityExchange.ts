import type { PokemonItemId } from '../calc/itemCatalog'

export type ExchangeItemId = number | PokemonItemId

export interface ExchangeOffer {
  id?: string
  itemId: ExchangeItemId
  quantity: number
  cost: number
  limit: number
  week: number
  seedPokemonId?: number
  opensAt?: string
}

export interface ExchangeReward {
  id: string
  label: string
  quantity: number
}
export interface ExchangeRewardGroup {
  id: string
  kind: 'mission' | 'gift'
  week: number
  opensAt: string
  closesAt: string
  rewards: ExchangeReward[]
}

export interface ActivityExchange {
  currencyItemId: number
  source: string
  offers: ExchangeOffer[]
  opensAt?: string
  closesAt?: string
  researchClosesAt?: string
  rewardGroups?: ExchangeRewardGroup[]
  rewardSources?: string[]
}

function validExchange(value: ActivityExchange, data?: Record<string, unknown>) {
  const positive = (n: number) => Number.isSafeInteger(n) && n > 0
  const items = (data?.['calc-tables.json'] as { modules?: { items?: {
    catalog?: { id: number; category: string; compatiblePokemonIds?: number[] }[]
    pokemonCatalog?: { id: string }[]
  } } } | undefined)?.modules?.items
  const pokemon = data?.['pokedex.json'] as { id: number }[] | undefined
  const keys = new Set<string>()
  return !!value && positive(value.currencyItemId)
    && (!data || items?.catalog?.some(item => item.id === value.currencyItemId && item.category === '活动研究物品'))
    && typeof value.source === 'string' && /^https:\/\/(?:www\.pokemonsleep\.net|pks\.raenonx\.cc|wikiwiki\.jp)\//.test(value.source)
    && Array.isArray(value.offers) && value.offers.length > 0
    && value.offers.every(row => {
      if (!row || !positive(row.quantity) || !positive(row.cost) || !positive(row.limit) || ![1, 2].includes(row.week)) return false
      const itemId = row.itemId
      const item = typeof itemId === 'number' ? items?.catalog?.find(entry => entry.id === itemId) : undefined
      if (typeof itemId === 'number' ? !positive(itemId) || !!data && !item : typeof itemId !== 'string' || !/^(?:Candy|Incense)-[1-9]\d*$/.test(itemId)) return false
      if (data && typeof itemId === 'string' && !items?.pokemonCatalog?.some(entry => entry.id === itemId)) {
        if (!itemId.startsWith('Incense-') || !pokemon?.some(entry => entry.id === Number(itemId.slice(8)))) return false
      }
      if (row.seedPokemonId !== undefined && (typeof itemId !== 'number' || !positive(row.seedPokemonId)
        || !!data && !item?.compatiblePokemonIds?.includes(row.seedPokemonId))) return false
      const key = JSON.stringify([itemId, row.seedPokemonId, row.quantity, row.cost, row.week])
      if (keys.has(key)) return false
      keys.add(key)
      return true
    })
}

export function validActivityExchanges(exchanges: ActivityExchange[], data?: Record<string, unknown>): boolean {
  const positive = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value > 0
  const text = (value: unknown) => typeof value === 'string' && !!value.trim()
  const id = (value: unknown) => typeof value === 'string' && /^[a-z0-9-]+$/.test(value)
  const time = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value + 'Z')) && new Date(value + 'Z').toISOString().slice(0, 19) === value
  const source = (value: unknown) => typeof value === 'string' && /^https:\/\/[^/]+\//.test(value)
  const unique = (values: unknown[]) => new Set(values).size === values.length
  if (!exchanges.every(shop => validExchange(shop, data))) return false
  if (!unique(exchanges.map(shop => shop.currencyItemId))) return false
  return exchanges.every(shop => {
    // Old snapshots have historical price lists without opening times.
    const scheduled = shop.opensAt !== undefined || shop.closesAt !== undefined
    if (scheduled && (!time(shop.opensAt) || !time(shop.closesAt) || shop.opensAt! >= shop.closesAt!)) return false
    if (!shop.offers.every(offer =>
      (!scheduled && offer.id === undefined || id(offer.id))
      && (offer.opensAt === undefined && (!scheduled || offer.week === 1) || offer.opensAt !== undefined && time(offer.opensAt) && scheduled && offer.opensAt >= shop.opensAt! && offer.opensAt < shop.closesAt!))
      || !unique(shop.offers.flatMap(offer => offer.id ? [offer.id] : []))) return false
    if (shop.researchClosesAt !== undefined && (!scheduled || !time(shop.researchClosesAt)
      || shop.researchClosesAt <= shop.opensAt! || shop.researchClosesAt > shop.closesAt!)) return false
    if (shop.rewardSources !== undefined && (!Array.isArray(shop.rewardSources) || !shop.rewardSources.every(source))) return false
    if (shop.rewardGroups === undefined) return true
    if (!scheduled || !Array.isArray(shop.rewardGroups) || !shop.rewardGroups.every(group =>
      group && id(group.id) && (group.kind === 'mission' || group.kind === 'gift') && positive(group.week)
      && time(group.opensAt) && time(group.closesAt) && group.opensAt >= shop.opensAt! && group.opensAt < group.closesAt
      && group.closesAt <= shop.closesAt! && Array.isArray(group.rewards) && group.rewards.length
      && group.rewards.every(reward => reward && id(reward.id) && text(reward.label) && positive(reward.quantity)))) return false
    return unique(shop.rewardGroups.map(group => group.id))
      && unique(shop.rewardGroups.flatMap(group => group.rewards.map(reward => reward.id)))
  })
}
