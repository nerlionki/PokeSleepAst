<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { ITEM_CATEGORIES, ITEMS, type ItemEntry } from '../../calc/items'
import { textHit } from '../../calc/text'
import DrawerSheet from '../shared/DrawerSheet.vue'

const props = defineProps<{ q: string }>()
const category = shallowRef('进化道具')
const open = shallowRef<ItemEntry | null>(null)
const listed = computed(() => ITEMS.filter((item) => item.category === category.value && textHit(item.name, props.q)))
</script>

<template>
  <div class="stack">
    <p class="muted">道具按 RAE 类别整理。仅进化道具收录获取途径；往期活动来源可打开 RAE 原页核对。</p>
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
      <p v-if="open.acquisition"><a href="https://wiki.pokesleep.com/zht/shop" target="_blank" rel="noopener noreferrer">常驻兑换处</a> · <a :href="open.sourceUrl" target="_blank" rel="noopener noreferrer">RAE 道具来源</a></p>
    </DrawerSheet>
  </div>
</template>

<style scoped>
.item-icon { width: 38px; height: 38px; object-fit: contain; }
.item-icon.large { width: 64px; height: 64px; }
</style>
