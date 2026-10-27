<script setup lang="ts">
import clientDefaults from '../../data/client-defaults.json'

import { computed, shallowRef } from 'vue'
import { ITEM_CATEGORIES, ITEMS, type ItemEntry } from '../../calc/items'
import { textHit } from '../../calc/text'
import DrawerSheet from '../shared/DrawerSheet.vue'
const components_data_ItemPane_config_clientDefaults = clientDefaults.modules.components_data_ItemPane


const props = defineProps<{ q: string }>()
const category = shallowRef(components_data_ItemPane_config_clientDefaults["categoryInitial"])
const open = shallowRef<ItemEntry | null>((components_data_ItemPane_config_clientDefaults["openInitial"] as unknown as ItemEntry | null))
const listed = computed(() => ITEMS.filter((item) => item.category === category.value && textHit(item.name, props.q)))
</script>

<template>
  <div class="stack">
    <div class="picker-filters">
      <button v-for="name in ITEM_CATEGORIES" :key="name" type="button" :class="{ on: category === name }" @click="category = name">{{ name }}</button>
    </div>
    <div class="icon-grid">
      <button v-for="item in listed" :key="item.id" type="button" class="icon-cell" @click="open = item">
        <img class="item-icon" :src="item.icon" :alt="item.name">
        <span>{{ item.name }}</span>
      </button>
    </div>
    <DrawerSheet v-if="open" :title="open.name" @close="open = null">
      <div class="row"><img class="item-icon large" :src="open.icon" :alt="open.name"><strong>{{ open.category }}</strong></div>
      <p v-if="open.acquisition">{{ open.acquisition }}</p>
      <p v-if="open.additionalAcquisition">{{ open.additionalAcquisition }}</p>
    </DrawerSheet>
  </div>
</template>
