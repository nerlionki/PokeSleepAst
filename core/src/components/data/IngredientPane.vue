<script setup lang="ts">
import { t as translateUi, gameText } from '../../ui/i18n'
import { ANNOUNCED } from '../../calc/announcedContent'
import clientDefaults from '../../data/client-defaults.resource'

import { computed, shallowRef } from 'vue'
import { INGREDIENTS, RECIPES } from '../../calc/data'
import { fixedIngredientProducers, productionRibbonHours } from '../../calc/precomputedProduction'
import { textHit } from '../../calc/text'
import { compareRecipeEnergyDescending } from '../../calc/recipes'
import DataRow from '../shared/DataRow.vue'
import IngredientIcon from '../shared/IngredientIcon.vue'
import MealIcon from '../shared/MealIcon.vue'
import PokeSprite from '../shared/PokeSprite.vue'
const components_data_IngredientPane_config_clientDefaults = clientDefaults.modules.components_data_IngredientPane


const props = defineProps<{ q: string }>()
const openId = shallowRef(components_data_IngredientPane_config_clientDefaults["openIdInitial"])

const list = computed(() => INGREDIENTS.filter((i) => textHit(i.name, props.q)))

const announced = computed(() => ANNOUNCED.ingredients.filter(i => !INGREDIENTS.some(known => known.name === i.name) && textHit(i.name, props.q)))
const top = fixedIngredientProducers

function usesOf(id: number) {
  return RECIPES.filter((r) => !r.mix && r.ingredients.some((ing) => ing.id === id)).sort((a, b) => compareRecipeEnergyDescending(a, b)).map((r) => ({
    name: r.name,
    count: r.ingredients.find((ing) => ing.id === id)?.count ?? 0,
    pot: r.pot,
  }))
}

function toggle(id: number) {
  openId.value = openId.value === id ? 0 : id
}
</script>

<template>
  <div>
    <article v-for="i in announced" :key="i.key" class="acc">
      <DataRow :title="gameText(i.name)" :subtitle="translateUi('能量与详情还未公布')">
        <template #lead><IngredientIcon v-if="i.imageId != null" :id="i.imageId" :name="i.name" /></template>
        <template #trail><span /></template>
      </DataRow>
    </article>
    <article v-for="i in list" :key="i.id" class="acc">
      <DataRow
        :title="gameText(i.name)"
        :subtitle="translateUi('能量 {arg1} · 梦碎 {arg2}', { arg1: String(i.energy), arg2: String(i.shards) })"
        @click="toggle(i.id)"
      >
        <template #lead>
          <IngredientIcon :id="i.id" :name="i.name" />
        </template>
        <template #trail>
          <span class="ing-tops" :title="top(i.id).map((p) => p.name).join('、')">
            <PokeSprite v-for="p in top(i.id)" :key="p.id" :id="p.id" :name="p.name" :ribbon-hours="productionRibbonHours(p.id)" />
          </span>
        </template>
      </DataRow>
      <div v-if="openId === i.id" class="acc-body">
        <p class="muted">{{ translateUi("日产量 Top3") }}</p>
        <p v-for="(p, index) in top(i.id)" :key="p.id" class="ing-top-line">
          <PokeSprite :id="p.id" :name="p.name" :ribbon-hours="productionRibbonHours(p.id)" />
          <span>{{ index + 1 }}. {{ gameText(p.name) }} · {{ p.total.toFixed(1) }} {{ translateUi("个/日") }}</span>
        </p>
        <p v-if="!top(i.id).length" class="muted">{{ translateUi("没有宝可梦能产出这个食材。") }}</p>
        <DataRow
          v-for="r in usesOf(i.id)"
          :key="r.name"
          :title="gameText(r.name)"
          :subtitle="translateUi('用量 {arg1} · 锅 {arg2}', { arg1: String(r.count), arg2: String(r.pot) })"
        >
          <template #lead>
            <MealIcon :name="r.name" />
          </template>
          <template #trail><span /></template>
        </DataRow>
        <p v-if="!usesOf(i.id).length" class="muted">{{ translateUi("没有收录使用该食材的食谱。") }}</p>
      </div>
    </article>
  </div>
</template>
