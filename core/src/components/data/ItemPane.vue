<script setup lang="ts">
  import { gameText, t as translateUi } from '../../ui/i18n';

  import { gameLabel } from '../../ui/gameLabels';
  import FallbackImage from '../shared/FallbackImage.vue';
  import clientDefaults from '../../data/client-defaults.resource';

  import { computed, shallowRef } from 'vue';
  import { ITEM_CATEGORIES, DISPLAY_ITEMS, type ItemEntry } from '../../calc/items';
  import { textHit } from '../../calc/text';
  import DrawerSheet from '../shared/DrawerSheet.vue';
  import PokeSprite from '../shared/PokeSprite.vue';
  import { pokeById } from '../../calc/data';
  import { pokemonUsingEvolutionItem } from '../../calc/evolution';
  import { ANNOUNCED } from '../../calc/announcedContent';
  const components_data_ItemPane_config_clientDefaults =
    clientDefaults.modules.components_data_ItemPane;

  const props = defineProps<{ q: string }>();
  const category = shallowRef(
    components_data_ItemPane_config_clientDefaults['categoryInitial']
  );
  const open = shallowRef<ItemEntry | null>(
    components_data_ItemPane_config_clientDefaults[
      'openInitial'
    ] as unknown as ItemEntry | null
  );
  const listed = computed(() =>
    DISPLAY_ITEMS.filter(
      item =>
        item.category === category.value &&
        textHit([item.name, gameLabel(item.name), gameText(item.name),
          ...itemPokemon(item).map(row => gameText(row.name))].join(' '), props.q)
    )
  );
  function itemPokemon(item: ItemEntry) {
    const ids = item.category === '进化道具' && typeof item.id === 'number'
      ? pokemonUsingEvolutionItem(item.id)
      : item.compatiblePokemonIds ?? [];
    return ids.flatMap(id => {
      const announced = ANNOUNCED.pokemon.find(row => (row.runtimeId ?? row.nationalDex ?? row.imageId) === id);
      const name = pokeById(id)?.name ?? announced?.name;
      return name ? [{ id: announced?.imageId ?? id, name }] : [];
    });
  }
  const compatible = computed(() => open.value ? itemPokemon(open.value) : []);
  const usage = computed(() => open.value?.usage ?? (open.value?.category === '进化道具' ? '用于满足指定宝可梦的进化条件。' : ''));
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
      <div class="row">
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
        </FallbackImage><strong>{{ translateUi(open.category) }}</strong>
      </div>
      <p v-if="usage"><strong>{{ translateUi('用途') }}</strong> {{ translateUi(usage) }}</p>
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
        <div class="row">
          <div v-for="pokemon in compatible" :key="pokemon.id" class="icon-cell">
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
.item-yield-row {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.35rem 0;
  font-variant-numeric: tabular-nums;
}
</style>
