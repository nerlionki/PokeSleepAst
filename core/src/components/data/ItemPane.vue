<script setup lang="ts">
  import { catalogText, gameText, t as translateUi } from '../../ui/i18n';

  import { gameLabel } from '../../ui/gameLabels';
  import FallbackImage from '../shared/FallbackImage.vue';
  import clientDefaults from '../../data/client-defaults.resource';

  import { computed, shallowRef } from 'vue';
  import { ITEM_CATEGORIES, DISPLAY_ITEMS, type DisplayItem } from '../../calc/items';
  import { textHit } from '../../calc/text';
  import DrawerSheet from '../shared/DrawerSheet.vue';
  import PokeSprite from '../shared/PokeSprite.vue';
  import { itemPokemon, itemUsage } from '../../ui/itemUsage';
  const components_data_ItemPane_config_clientDefaults =
    clientDefaults.modules.components_data_ItemPane;

  const props = defineProps<{ q: string }>();
  const category = shallowRef(
    components_data_ItemPane_config_clientDefaults['categoryInitial']
  );
  const open = shallowRef<DisplayItem | null>(
    components_data_ItemPane_config_clientDefaults[
      'openInitial'
    ] as unknown as DisplayItem | null
  );
  const listed = computed(() =>
    DISPLAY_ITEMS.filter(
      item =>
        item.category === category.value &&
        textHit([item.name, gameLabel(item.name), gameText(item.name),
          ...itemPokemon(item).map(row => gameText(row.name))].join(' '), props.q)
    )
  );
  const compatible = computed(() => open.value ? itemPokemon(open.value) : []);
  const usage = computed(() => open.value ? itemUsage(open.value, compatible.value) : '');
</script>

<template>
  <div class="stack">
    <div class="picker-filters">
      <button
        v-for="name in ITEM_CATEGORIES"
        :key="name"
        type="button"
        :class="{ on: category === name }"
        @click="category = name"
      >
        {{ translateUi(name) }}
      </button>
    </div>
    <div class="icon-grid">
      <button
        v-for="item in listed"
        :key="item.id"
        type="button"
        class="icon-cell"
        @click="open = item"
      >
        <FallbackImage
          loading="lazy"
          decoding="async"
          class="item-icon"
          :src="item.icon"
          :alt="gameText(item.name)"
        >
          <template v-if="item.pokemonItem?.kind === 'incense'" #fallback>
            <PokeSprite :id="item.pokemonItem.pokemonId" />
          </template>
        </FallbackImage>
        <span>{{ gameText(item.name) }}</span>
      </button>
    </div>
    <DrawerSheet v-if="open" :title="gameText(open.name)" @close="open = null">
      <div class="item-detail-heading">
        <div class="item-detail-image">
          <FallbackImage
            loading="lazy"
            decoding="async"
            class="item-icon large"
            :src="open.icon"
            :alt="gameText(open.name)"
          >
            <template v-if="open.pokemonItem?.kind === 'incense'" #fallback>
              <PokeSprite :id="open.pokemonItem.pokemonId" />
            </template>
          </FallbackImage>
        </div>
        <strong>{{ translateUi(open.category) }}</strong>
      </div>
      <div v-if="open.researchEvents.length">
        <strong>{{ translateUi('对应活动') }}</strong>
        <div v-for="event in open.researchEvents" :key="event.id">
          {{ catalogText('活动标题', event.id, event.name) }}
        </div>
      </div>
      <p v-if="usage"><strong>{{ translateUi('用途') }}</strong> {{ usage }}</p>
      <div v-if="open.dreamShardsByResearchRank?.length">
        <div class="item-yield-row">
          <strong>{{ translateUi('研究等级') }}</strong>
          <strong>{{ translateUi('梦之碎片') }}</strong>
        </div>
        <div
          v-for="(amount, index) in open.dreamShardsByResearchRank"
          :key="index"
          class="item-yield-row"
        >
          <span>{{ index + 1 }}</span>
          <span>{{ amount.toLocaleString() }}</span>
        </div>
      </div>
      <div v-if="compatible.length" class="stack">
        <h3>{{ translateUi('适用宝可梦') }}</h3>
        <div class="item-pokemon-list">
          <div v-for="pokemon in compatible" :key="pokemon.id" class="item-pokemon-card">
            <PokeSprite :id="pokemon.id" :name="pokemon.name" />
            <span>{{ gameText(pokemon.name) }}</span>
          </div>
        </div>
      </div>
      <p v-if="open.acquisition">{{ translateUi(open.acquisition) }}</p>
      <p v-if="open.additionalAcquisition">
        {{ translateUi(open.additionalAcquisition) }}
      </p>
    </DrawerSheet>
  </div>
</template>

<style scoped>
.item-detail-heading {
  display: flex;
  align-items: center;
  gap: 12px;
}
.item-detail-heading > strong {
  min-width: 0;
  overflow-wrap: anywhere;
}
.item-detail-image {
  display: flex;
  flex: 0 0 64px;
  align-items: center;
  justify-content: center;
  min-height: 64px;
  min-width: 0;
  overflow-wrap: anywhere;
}
.item-pokemon-list {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 8px;
}
.item-pokemon-card {
  display: flex;
  flex: 0 1 76px;
  flex-direction: column;
  align-items: center;
  min-width: 0;
  max-width: 100%;
  gap: 4px;
  padding: 8px 4px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--card);
  font-size: var(--font-11);
  text-align: center;
  overflow-wrap: anywhere;
}
.item-yield-row {
  display: flex;
  justify-content: space-between;
  gap: var(--font-16);
  padding: calc(var(--font-16) * 0.35) 0;
  font-variant-numeric: tabular-nums;
}
</style>
