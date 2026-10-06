<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { POT_TIERS, RECIPES } from '../../calc/data'
import { MEAL_CATEGORIES, type RecipeRow } from '../../calc/recipes'
import { textHit } from '../../calc/text'
import RecipeCard from './RecipeCard.vue'
import RecipeSheet from './RecipeSheet.vue'

const props = defineProps<{ q: string }>()
const index = shallowRef(0)
const category = shallowRef<(typeof MEAL_CATEGORIES)[number]['id']>('curry')
const level = shallowRef(1)
const opened = shallowRef<RecipeRow | null>(null)

const tier = computed(() => POT_TIERS[index.value])

function spent(upto: number) {
  return POT_TIERS.slice(0, upto + 1).reduce((sum, row) => sum + row.shards, 0)
}

const recipes = computed(() => RECIPES.filter((r) => r.category === category.value && textHit(r.name, props.q)))

const ready = computed(() => recipes.value
  .filter((r) => r.pot <= tier.value.pot)
  .sort((a, b) => a.pot - b.pot || b.baseEnergy - a.baseEnergy))

const overflow = computed(() => {
  const max = POT_TIERS[POT_TIERS.length - 1].pot
  return recipes.value.filter((r) => r.pot > max).sort((a, b) => a.pot - b.pot || b.baseEnergy - a.baseEnergy)
})

const later = computed(() => POT_TIERS.slice(index.value + 1).map((row, offset) => {
  const at = index.value + 1 + offset
  const prev = POT_TIERS[at - 1].pot
  return {
    pot: row.pot,
    shards: row.shards,
    total: spent(at),
    recipes: recipes.value
      .filter((r) => r.pot > prev && r.pot <= row.pot)
      .sort((a, b) => a.pot - b.pot || b.baseEnergy - a.baseEnergy),
  }
}))

function shift(step: number) {
  index.value = Math.min(POT_TIERS.length - 1, Math.max(0, index.value + step))
}
</script>

<template>
  <div class="stack">
    <div class="pot-bar">
      <button type="button" aria-label="上一档" :disabled="index === 0" @click="shift(-1)">‹</button>
      <div>
        <strong>容量 {{ tier.pot }}</strong>
        <em>{{ index === 0 ? '初始锅，无需梦碎' : `累计梦碎 ${spent(index).toLocaleString('zh-CN')}` }}</em>
      </div>
      <button type="button" aria-label="下一档" :disabled="index === POT_TIERS.length - 1" @click="shift(1)">›</button>
    </div>
    <div class="seg seg-3">
      <button
        v-for="c in MEAL_CATEGORIES"
        :key="c.id"
        type="button"
        :class="{ on: category === c.id }"
        @click="category = c.id"
      >{{ c.label }}</button>
    </div>
    <label class="recipe-tools">
      食谱等级
      <select v-model.number="level">
        <option v-for="lv in [1, 10, 20, 30, 40, 50, 60]" :key="lv" :value="lv">{{ lv }}</option>
      </select>
    </label>
    <p class="muted">当前可做 {{ ready.length }} 道</p>
    <div class="meal-grid">
      <RecipeCard v-for="r in ready" :key="r.name" :recipe="r" :level="level" @open="opened = r" />
    </div>
    <section v-for="block in later" :key="block.pot" class="pot-next">
      <p>
        <strong>锅 {{ block.pot }}</strong>
        <span>梦碎 {{ block.total.toLocaleString('zh-CN') }}（+{{ block.shards.toLocaleString('zh-CN') }}）</span>
      </p>
      <div v-if="block.recipes.length" class="meal-grid">
        <RecipeCard v-for="r in block.recipes" :key="r.name" :recipe="r" :level="level" @open="opened = r" />
      </div>
    </section>
    <section v-if="overflow.length" class="pot-next">
      <p>
        <strong>更大的锅</strong>
        <span>这些食谱超过现有锅档 {{ POT_TIERS[POT_TIERS.length - 1].pot }}</span>
      </p>
      <div class="meal-grid">
        <RecipeCard v-for="r in overflow" :key="r.name" :recipe="r" :level="level" @open="opened = r" />
      </div>
    </section>
    <RecipeSheet v-if="opened" :recipe="opened" :level="level" @close="opened = null" />
  </div>
</template>
