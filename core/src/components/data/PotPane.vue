<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { POT_TIERS, RECIPES } from '../../calc/data'
import { MEAL_CATEGORIES, type RecipeRow } from '../../calc/recipes'
import { RECIPE_LEVEL_MAX, recipeLevelOf } from '../../calc/cook'
import { useSettingsStore } from '../../stores/settings'
import { textHit } from '../../calc/text'
import RecipeCard from './RecipeCard.vue'
import RecipeSheet from './RecipeSheet.vue'

const props = defineProps<{ q: string }>()
const store = useSettingsStore()
const minimumIndex = computed(() => {
  const at = POT_TIERS.findIndex(row => row.pot >= store.settings.potSize)
  return at < 0 ? POT_TIERS.length : at
})
const index = shallowRef(0)
watch(minimumIndex, at => { index.value = at }, { immediate: true })
const category = shallowRef<(typeof MEAL_CATEGORIES)[number]['id']>('curry')
const opened = shallowRef<RecipeRow | null>(null)

const tier = computed(() => POT_TIERS[index.value])
const nextTier = computed(() => POT_TIERS[index.value + 1])

function setRecipeLevel(name: string, value: number) {
  store.settings.recipeLevels = {
    ...store.settings.recipeLevels,
    [name]: Math.min(RECIPE_LEVEL_MAX, Math.max(1, Math.trunc(value) || 1)),
  }
}

function spent(upto: number) {
  return POT_TIERS.slice(0, upto + 1).reduce((sum, row) => sum + row.shards, 0)
}

const recipes = computed(() => RECIPES.filter((r) => r.category === category.value && textHit(r.name, props.q)))

const ready = computed(() => recipes.value
  .filter((r) => tier.value && r.pot <= tier.value.pot)
  .sort((a, b) => b.pot - a.pot || b.baseEnergy - a.baseEnergy))

const overflow = computed(() => {
  const max = POT_TIERS[POT_TIERS.length - 1].pot
  return recipes.value.filter((r) => r.pot > max).sort((a, b) => b.pot - a.pot || b.baseEnergy - a.baseEnergy)
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
      .sort((a, b) => b.pot - a.pot || b.baseEnergy - a.baseEnergy),
  }
}))

function shift(step: number) {
  index.value = Math.min(POT_TIERS.length - 1, Math.max(minimumIndex.value, index.value + step))
}
</script>

<template>
  <div class="stack">
    <div v-if="tier" class="pot-bar">
      <button type="button" aria-label="上一档" :disabled="index <= minimumIndex" @click="shift(-1)">‹</button>
      <div>
        <strong>容量 {{ tier.pot }}</strong>
        <em>{{ `累计梦碎 ${spent(index).toLocaleString('zh-CN')}` }}</em>
        <em v-if="nextTier">升至容量 {{ nextTier.pot }} 需梦碎 {{ nextTier.shards.toLocaleString('zh-CN') }}</em>
        <em v-else>已达最高锅容量</em>
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
    <p class="muted">食谱等级使用全局设置，点击食谱可调整，即时生效。</p>
    <p v-if="!tier" class="muted">全局锅容量 {{ store.settings.potSize }} 已超过现有最高锅档 {{ POT_TIERS[POT_TIERS.length - 1].pot }}。</p>
    <p class="muted">当前可做 {{ ready.length }} 道</p>
    <div class="meal-grid">
      <RecipeCard v-for="r in ready" :key="r.name" :recipe="r" :level="recipeLevelOf(store.settings, r.name)" @open="opened = r" />
    </div>
    <section v-for="block in later" :key="block.pot" class="pot-next">
      <p>
        <strong>锅 {{ block.pot }}</strong>
        <span>累计梦碎 {{ block.total.toLocaleString('zh-CN') }} · 升至此档需 {{ block.shards.toLocaleString('zh-CN') }}</span>
      </p>
      <div v-if="block.recipes.length" class="meal-grid">
        <RecipeCard v-for="r in block.recipes" :key="r.name" :recipe="r" :level="recipeLevelOf(store.settings, r.name)" @open="opened = r" />
      </div>
    </section>
    <section v-if="overflow.length" class="pot-next">
      <p>
        <strong>更大的锅</strong>
        <span>这些食谱超过现有锅档 {{ POT_TIERS[POT_TIERS.length - 1].pot }}</span>
      </p>
      <div class="meal-grid">
        <RecipeCard v-for="r in overflow" :key="r.name" :recipe="r" :level="recipeLevelOf(store.settings, r.name)" @open="opened = r" />
      </div>
    </section>
    <RecipeSheet v-if="opened" :recipe="opened" :level="recipeLevelOf(store.settings, opened.name)" editable-level @update:level="setRecipeLevel(opened.name, $event)" @close="opened = null" />
  </div>
</template>
