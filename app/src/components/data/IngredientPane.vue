<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { INGREDIENTS, RECIPES } from '../../calc/data'
import { topIngredientProducers } from '../../calc/ingredients'
import { textHit } from '../../calc/text'
import DataRow from '../shared/DataRow.vue'
import IngredientIcon from '../shared/IngredientIcon.vue'
import MealIcon from '../shared/MealIcon.vue'
import PokeSprite from '../shared/PokeSprite.vue'

const props = defineProps<{ q: string }>()
const openId = shallowRef(0)

const list = computed(() => INGREDIENTS.filter((i) => textHit(i.name, props.q)))

function usesOf(id: number) {
  return RECIPES.filter((r) => !r.mix && r.ingredients.some((ing) => ing.id === id)).map((r) => ({
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
    <article v-for="i in list" :key="i.id" class="acc">
      <DataRow
        :title="i.name"
        :subtitle="`能量 ${i.energy} · 梦碎 ${i.shards}`"
        @click="toggle(i.id)"
      >
        <template #lead>
          <IngredientIcon :id="i.id" :name="i.name" />
        </template>
        <template #trail>
          <span class="ing-tops" :title="topIngredientProducers(i.id).map((p) => p.name).join('、')">
            <PokeSprite v-for="p in topIngredientProducers(i.id)" :key="p.id" :id="p.id" :name="p.name" />
          </span>
        </template>
      </DataRow>
      <div v-if="openId === i.id" class="acc-body">
        <p class="muted">产量最高</p>
        <p v-for="(p, index) in topIngredientProducers(i.id)" :key="p.id" class="ing-top-line">
          <PokeSprite :id="p.id" :name="p.name" />
          <span>{{ index + 1 }}. {{ p.name }}</span>
        </p>
        <p v-if="!topIngredientProducers(i.id).length" class="muted">没有宝可梦能产出这个食材。</p>
        <DataRow
          v-for="r in usesOf(i.id)"
          :key="r.name"
          :title="r.name"
          :subtitle="`用量 ${r.count} · 锅 ${r.pot}`"
        >
          <template #lead>
            <MealIcon :name="r.name" />
          </template>
          <template #trail><span /></template>
        </DataRow>
        <p v-if="!usesOf(i.id).length" class="muted">没有收录使用该食材的食谱。</p>
      </div>
    </article>
  </div>
</template>
