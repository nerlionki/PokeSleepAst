<script setup lang="ts">
import clientDefaults from '../../data/client-defaults.resource'

import { computed, ref, shallowRef } from 'vue'
import { INGREDIENTS, RECIPES } from '../../calc/data'
import { MEAL_CATEGORIES, type RecipeRow } from '../../calc/recipes'
import { toggleChoice } from '../../calc/multiChoice'
import IngredientIcon from '../shared/IngredientIcon.vue'
import RecipeCard from './RecipeCard.vue'
import RecipeSheet from './RecipeSheet.vue'
const components_data_RecipePane_config_clientDefaults = clientDefaults.modules.components_data_RecipePane


const ingredients = ref<number[]>([])
const showIngredients = shallowRef(true)
const category = shallowRef<(typeof MEAL_CATEGORIES)[number]['id']>((components_data_RecipePane_config_clientDefaults["categoryInitial"] as unknown as (typeof MEAL_CATEGORIES)[number]['id']))
const sort = shallowRef<'energy' | 'pot'>('energy')
const ascending = shallowRef(false)
const opened = shallowRef<RecipeRow | null>((components_data_RecipePane_config_clientDefaults["openedInitial"] as unknown as RecipeRow | null))

const list = computed(() => {
  const rows = RECIPES.filter((r) => {
    return r.category === category.value
      && (!ingredients.value.length || r.ingredients.some(ingredient => ingredients.value.includes(ingredient.id)))
  })
  return rows.sort((a, b) => {
    const difference = sort.value === 'pot' ? a.pot - b.pot : a.baseEnergy - b.baseEnergy
    return difference * (ascending.value ? 1 : -1)
      || (sort.value === 'pot' ? b.baseEnergy - a.baseEnergy : a.pot - b.pot)
      || a.name.localeCompare(b.name, 'zh-CN')
  })
})
function resetFilters() { ingredients.value = [] }
</script>

<template>
  <div class="stack">
    <div class="seg seg-3">
      <button
        v-for="c in MEAL_CATEGORIES"
        :key="c.id"
        type="button"
        :class="{ on: category === c.id }"
        @click="category = c.id"
      >{{ c.label }}</button>
    </div>
    <div class="picker-filters">
      <button type="button" :aria-expanded="showIngredients" @click="showIngredients = !showIngredients">{{ showIngredients ? '收起食材' : '展开食材' }}{{ ingredients.length ? `（已选 ${ingredients.length}）` : '' }}</button>
      <button type="button" class="ghost" @click="resetFilters">重置筛选</button>
    </div>
    <section v-if="showIngredients" class="stack">
      <p class="muted">包含任一所选食材</p>
      <div class="picker-opts">
        <button type="button" :class="{ on: !ingredients.length }" @click="ingredients = []">全部</button>
        <button v-for="ingredient in INGREDIENTS" :key="ingredient.id" type="button" :class="{ on: ingredients.includes(ingredient.id) }" :aria-pressed="ingredients.includes(ingredient.id)" @click="toggleChoice(ingredients, ingredient.id, INGREDIENTS.map(item => item.id))"><IngredientIcon :id="ingredient.id" :name="ingredient.name" small />{{ ingredient.name }}</button>
      </div>
    </section>
    <div class="recipe-tools">
      <label>
        排序
        <select v-model="sort">
          <option value="energy">基础能量</option>
          <option value="pot">锅容量</option>
        </select>
      </label>
      <label>
        顺序
        <select v-model="ascending">
          <option :value="false">从高到低</option>
          <option :value="true">从低到高</option>
        </select>
      </label>
    </div>
    <p class="muted">{{ list.length }} 道</p>
    <p v-if="!list.length" class="muted">暂无符合条件的食谱，可调整食材筛选。</p>
    <div class="meal-grid">
      <RecipeCard
        v-for="r in list"
        :key="r.name"
        :recipe="r"
        @open="opened = r"
      />
    </div>
    <RecipeSheet v-if="opened" :recipe="opened" @close="opened = null" />
  </div>
</template>
