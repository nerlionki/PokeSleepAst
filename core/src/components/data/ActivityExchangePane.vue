<script setup lang="ts">
import { computed } from 'vue'
import { pokeById } from '../../calc/data'
import { itemById, itemImage } from '../../calc/items'
import type { ActivityExchange } from '../../resources/activityArchive'
import { gameText, t } from '../../ui/i18n'
import FallbackImage from '../shared/FallbackImage.vue'
import PokeSprite from '../shared/PokeSprite.vue'

const props = defineProps<{ exchange: ActivityExchange }>()
const currency = computed(() => itemById(props.exchange.currencyItemId))
const groups = computed(() => ([1, 2] as const).map(week => ({
  week,
  label: week === 1 ? '常规兑换' : '第2周追加',
  offers: props.exchange.offers.filter(row => row.week === week).map(row => {
    const item = itemById(row.itemId)
    const incense = !item && typeof row.itemId === 'string' && row.itemId.startsWith('Incense-')
    const pokemonId = row.seedPokemonId ?? (incense ? Number(String(row.itemId).slice(8)) : undefined)
    const pokemon = pokemonId === undefined ? undefined : pokeById(pokemonId)
    return {
      ...row,
      pokemonId,
      icon: item ? itemImage(item) : '',
      key: JSON.stringify([row.itemId, row.seedPokemonId, row.quantity, row.cost]),
      name: row.seedPokemonId && pokemon
        ? t('主技能种子（{pokemon}）', { pokemon: gameText(pokemon.name) })
        : incense && pokemon ? t('{pokemon}的薰香', { pokemon: gameText(pokemon.name) }) : gameText(item?.name),
    }
  }),
})).filter(group => group.offers.length))
</script>

<template>
  <div v-if="currency" class="stack">
    <section v-for="group in groups" :key="group.week" class="card stack">
      <h3>{{ t(group.label) }}</h3>
      <div v-for="offer in group.offers" :key="offer.key" class="activity-exchange-offer">
        <FallbackImage v-if="offer.icon" class="activity-exchange-icon" :src="offer.icon" alt="">
          <template #fallback><span /></template>
        </FallbackImage>
        <PokeSprite v-else-if="offer.pokemonId" class="activity-exchange-icon" :id="offer.pokemonId" />
        <div class="activity-exchange-reward">
          <strong>{{ offer.name }} ×{{ offer.quantity }}</strong>
          <span class="muted">{{ t('限兑 {count} 次', { count: offer.limit }) }}</span>
        </div>
        <span class="activity-exchange-cost">{{ gameText(currency.name) }} ×{{ offer.cost }}</span>
      </div>
    </section>
  </div>
</template>

<style scoped>
.activity-exchange-offer { display: flex; align-items: center; gap: 8px; min-width: 0; }
.activity-exchange-offer + .activity-exchange-offer { border-top: 1px solid var(--line); padding-top: 8px; }
.activity-exchange-icon { flex: none; width: 28px; height: 28px; object-fit: contain; }
.activity-exchange-reward { display: flex; flex: 1; flex-direction: column; gap: 2px; min-width: 0; overflow-wrap: anywhere; }
.activity-exchange-reward > span { font-size: var(--font-12); }
.activity-exchange-cost { max-width: 46%; min-width: 0; color: var(--amber); text-align: right; overflow-wrap: anywhere; }
</style>
