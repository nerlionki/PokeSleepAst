<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { RECIPES } from '../../calc/data'
import { MEAL_CATEGORIES, RECIPE_LEVELS, type RecipeRow } from '../../calc/recipes'
import { textHit } from '../../calc/text'
import RecipeCard from './RecipeCard.vue'
import RecipeSheet from './RecipeSheet.vue'

const props = defineProps<{ q: string }>()
const category = shallowRef<(typeof MEAL_CATEGORIES)[number]['id']>('curry')
const level = shallowRef<number>(1)
const sort = shallowRef<'energy' | 'pot'>('energy')
const opened = shallowRef<RecipeRow | null>(null)

const list = computed(() => {
  const rows = RECIPES.filter((r) => r.category === category.value && textHit(r.name, props.q))
  return rows.sort((a, b) => {
    if (sort.value === 'pot') return a.pot - b.pot || b.baseEnergy - a.baseEnergy
    return b.baseEnergy - a.baseEnergy || a.pot - b.pot
  })
})
</script>

<template>
  <div class="stack">
    <div class="seg">
      <button
        v-for="c in MEAL_CATEGORIES"
        :key="c.id"
        type="button"
        :class="{ on: category === c.id }"
        @click="category = c.id"
      >{{ c.label }}</button>
    </div>
    <div class="recipe-tools">
      <label>
        食谱等级
        <select v-model.number="level">
          <option v-for="lv in RECIPE_LEVELS" :key="lv" :value="lv">{{ lv }}</option>
        </select>
      </label>
      <label>
        排序
        <select v-model="sort">
          <option value="energy">基础能量</option>
          <option value="pot">锅容量</option>
        </select>
      </label>
    </div>
    <p class="muted">{{ list.length }} 道</p>
    <div class="meal-grid">
      <RecipeCard
        v-for="r in list"
        :key="r.name"
        :recipe="r"
        :level="level"
        @open="opened = r"
      />
    </div>
    <RecipeSheet v-if="opened" :recipe="opened" :level="level" @close="opened = null" />
  </div>
</template>
