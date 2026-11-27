<script setup lang="ts">
import { computed } from 'vue'
import { exchangeQuantity, groupExchangeOffers, type ExchangeShop } from '../../calc/eventExchange'
import { pokeById } from '../../calc/data'
import { itemById, itemImage } from '../../calc/items'
import type { ExchangeOffer } from '../../resources/activityExchange'
import PokeSprite from '../shared/PokeSprite.vue'
import FallbackImage from '../shared/FallbackImage.vue'
import { gameText, t } from '../../ui/i18n'

const props = defineProps<{ shop: ExchangeShop; quantities?: Record<string, number>; now?: number }>()
const emit = defineEmits<{ set: [id: string, quantity: number]; max: [] }>()
const groups = computed(() => groupExchangeOffers(props.shop.exchange.offers))
const currency = computed(() => gameText(itemById(props.shop.exchange.currencyItemId)?.name ?? String(props.shop.exchange.currencyItemId)))

function linkedPokemon(offer: ExchangeOffer) {
  if (offer.seedPokemonId) return pokeById(offer.seedPokemonId)
  return typeof offer.itemId === 'string' ? pokeById(Number(offer.itemId.split('-')[1])) : undefined
}
function itemName(offer: ExchangeOffer) {
  const pokemon = linkedPokemon(offer)
  if (pokemon && offer.seedPokemonId) return t('主技能种子（{pokemon}）', { pokemon: gameText(pokemon.name) })
  const item = itemById(offer.itemId)
  if (item) return gameText(item.name)
  if (pokemon && String(offer.itemId).startsWith('Incense-')) return t('{pokemon}的薰香', { pokemon: gameText(pokemon.name) })
  return String(offer.itemId)
}
function icon(offer: ExchangeOffer) {
  const item = itemById(offer.itemId)
  return item ? itemImage(item) : ''
}

function update(offer: ExchangeOffer, event: Event) {
  if (!offer.id) return
  const input = event.target as HTMLInputElement
  const quantity = exchangeQuantity(input.value, offer.limit)
  emit('set', offer.id, quantity)
}
</script>

<template>
  <section class="stack">
    <div v-if="quantities" class="row exchange-offer-toolbar">
      <h3>{{ t('兑换商店') }}</h3>
      <button class="btn ghost" type="button" @click="emit('max')">{{ t('全部 MAX') }}</button>
    </div>
    <article v-for="group in groups" :key="group.key" class="card stack">
      <div v-if="group.offers[0]" class="row">
        <FallbackImage v-if="icon(group.offers[0])" class="exchange-offer-icon" :src="icon(group.offers[0])" alt=""><template #fallback><span /></template></FallbackImage>
        <PokeSprite v-else-if="linkedPokemon(group.offers[0])" class="exchange-offer-icon" :id="linkedPokemon(group.offers[0])!.id" />
        <strong>{{ itemName(group.offers[0]) }}</strong>
      </div>
      <div v-for="(offer, index) in group.offers" :key="offer.id ?? index" class="exchange-offer-row">
        <div class="stack">
          <strong>{{ currency }} × {{ offer.cost }}</strong>
          <span class="muted">{{ t('每次兑换 {quantity} 件', { quantity: offer.quantity }) }} · {{ t('限兑 {count} 次', { count: offer.limit }) }}</span>
          <span v-if="offer.opensAt && (now === undefined || now < Date.parse(offer.opensAt))" class="muted">{{ t('{time} 开放', { time: offer.opensAt.slice(0, 16).replace('T', ' ') }) }}</span>
          <span v-else-if="offer.week > 1" class="muted">{{ t('第 {week} 周追加', { week: offer.week }) }}</span>
        </div>
        <div v-if="quantities && offer.id" class="row exchange-offer-controls">
          <input class="exchange-offer-quantity" type="number" min="0" :max="offer.limit" step="1"
            :aria-label="t('{item}的计划兑换次数', { item: itemName(offer) })"
            :value="exchangeQuantity(quantities[offer.id], offer.limit)" @input="update(offer, $event)">
          <button class="btn ghost" type="button" @click="emit('set', offer.id, offer.limit)">MAX</button>
        </div>
      </div>
    </article>
  </section>
</template>

<style scoped>
.exchange-offer-toolbar, .exchange-offer-row { display: flex; align-items: center; justify-content: space-between; gap: .55rem; flex-wrap: wrap; }
.exchange-offer-row + .exchange-offer-row { border-top: 1px solid var(--line); padding-top: .55rem; }
.exchange-offer-row .stack { gap: .15rem; }
.exchange-offer-icon { width: 32px; height: 32px; object-fit: contain; }
.exchange-offer-controls { gap: .35rem; }
.exchange-offer-quantity { width: 5rem; }
</style>
