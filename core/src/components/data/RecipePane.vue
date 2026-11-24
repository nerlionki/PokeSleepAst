<script setup lang="ts">
import { gameText, t as translateUi } from '../../ui/i18n'


import { INGREDIENT_CATALOG } from '../../calc/ingredientCatalog'
import { RECIPE_CATALOG, recipeDisplayLevelKey, type RecipeDisplayRow } from '../../calc/recipeCatalog'
import { recipeLevelOf } from '../../calc/cook'
import { useSettingsStore } from '../../stores/settings'
import clientDefaults from '../../data/client-defaults.resource'

import { computed, ref, shallowRef, watch } from 'vue'
import type { MealCategorySelection } from '../../types'
import { textHit } from '../../calc/text'
import { toggleChoice } from '../../calc/multiChoice'
import IngredientIcon from '../shared/IngredientIcon.vue'
import RecipeCard from './RecipeCard.vue'
import RecipeCategoryTabs from './RecipeCategoryTabs.vue'
import RecipeSheet from './RecipeSheet.vue'
const components_data_RecipePane_config_clientDefaults = clientDefaults.modules.components_data_RecipePane


const ingredientOptions = INGREDIENT_CATALOG
const store = useSettingsStore()
const props = defineProps<{ q?: string; selectable?: boolean; selectedId?: number; disabled?: boolean }>()
const emit = defineEmits<{ pick: [id: number] }>()
const query = shallowRef('')
const pageSize = 8
const visibleCount = shallowRef(pageSize)
const ingredients = ref<string[]>([])
const showIngredients = shallowRef(false)
const category = shallowRef<MealCategorySelection>((components_data_RecipePane_config_clientDefaults.categoryViewInitial ?? 'all') as MealCategorySelection)
const sort = shallowRef<'energy' | 'pot'>('energy')
const ascending = shallowRef(false)
const opened = shallowRef<RecipeDisplayRow | null>((components_data_RecipePane_config_clientDefaults["openedInitial"] as unknown as RecipeDisplayRow | null))

const list = computed(() => {
  const rows = RECIPE_CATALOG.filter((r) => {
    if (props.selectable && (r.mix || r.announcementKey || !r.ingredients.length)) return false
    if (category.value !== 'all' && r.category !== category.value) return false
    const search = props.selectable ? query.value : props.q ?? ''
    const matchesQuery = [r.name, ...r.ingredients.map(ingredient => ingredient.name)]
      .some(name => textHit(name, search) || textHit(gameText(name), search))
    return matchesQuery && (!ingredients.value.length || r.ingredients.some(ingredient =>
      ingredients.value.includes(ingredient.filterKey ?? String(ingredient.id))))
  })
  return rows.sort((a, b) => {
    const left = sort.value === 'pot' ? a.pot : a.baseEnergy
    const right = sort.value === 'pot' ? b.pot : b.baseEnergy
    if (left == null || right == null) return left == null ? (right == null ? a.name.localeCompare(b.name, 'zh-CN') : 1) : -1
    const difference = left - right
    return difference * (ascending.value ? 1 : -1)
      || (sort.value === 'pot' ? (b.baseEnergy ?? -1) - (a.baseEnergy ?? -1) : a.pot - b.pot)
      || a.name.localeCompare(b.name, 'zh-CN')
  })
})
watch(list, () => { visibleCount.value = pageSize })
const shown = computed(() => props.selectable ? list.value.slice(0, visibleCount.value) : list.value)
function resetFilters() { ingredients.value = [] }
function open(recipe: RecipeDisplayRow) {
  if (props.selectable) {
    if (!props.disabled) emit('pick', recipe.id)
  } else opened.value = recipe
}

function levelOf(recipe: RecipeDisplayRow) {
  const key = recipeDisplayLevelKey(recipe)
  return key == null ? undefined : recipeLevelOf(store.settings, key)
}
</script>

<template>
  <div class="stack">
    <input v-if="selectable" v-model="query" class="picker-search" :aria-label="translateUi('搜索食谱或食材')" :placeholder="translateUi('搜索食谱或食材')">
    <RecipeCategoryTabs v-model="category" />
    <div class="picker-filters">
      <button type="button" :aria-expanded="showIngredients" @click="showIngredients = !showIngredients">{{ showIngredients ? translateUi("收起食材") : translateUi("展开食材") }}{{ ingredients.length ? translateUi("（已选 {arg1}）", { arg1: String(ingredients.length) }) : '' }}</button>
      <button type="button" class="ghost" @click="resetFilters">{{ translateUi("重置筛选") }}</button>
    </div>
    <section v-if="showIngredients" class="stack">
      <p class="muted">{{ translateUi("包含任一所选食材") }}</p>
      <div class="picker-opts">
        <button type="button" :class="{ on: !ingredients.length }" @click="ingredients = []">{{ translateUi("全部") }}</button>
        <button v-for="ingredient in ingredientOptions" :key="ingredient.key" type="button" :class="{ on: ingredients.includes(ingredient.key) }" :aria-pressed="ingredients.includes(ingredient.key)" @click="toggleChoice(ingredients, ingredient.key, ingredientOptions.map(item => item.key))"><IngredientIcon :id="ingredient.imageId" :name="ingredient.name" small />{{ gameText(ingredient.name) }}</button>
      </div>
    </section>
    <div class="recipe-tools">
      <label>
        {{ translateUi("排序") }}
        <select v-model="sort">
          <option value="energy">{{ translateUi("基础能量") }}</option>
          <option value="pot">{{ translateUi("锅容量") }}</option>
        </select>
      </label>
      <label>
        {{ translateUi("顺序") }}
        <select v-model="ascending">
          <option :value="false">{{ translateUi("从高到低") }}</option>
          <option :value="true">{{ translateUi("从低到高") }}</option>
        </select>
      </label>
    </div>
    <p class="muted">{{ list.length }} {{ translateUi("道") }}</p>
    <p v-if="!list.length" class="muted">{{ translateUi("暂无符合条件的食谱，可调整食材筛选。") }}</p>
    <div class="meal-grid">
      <RecipeCard
        v-for="r in shown"
        :key="r.id > 0 ? r.id : r.announcementKey"
        :recipe="r"
        :level="levelOf(r)"
        :selected="selectable ? selectedId === r.id : undefined"
        :disabled="selectable && disabled"
        @open="open(r)"
      />
    </div>
    <button v-if="selectable && visibleCount < list.length" type="button" class="btn ghost" @click="visibleCount += pageSize">
      {{ translateUi('加载更多食谱') }}
    </button>
    <RecipeSheet v-if="opened" :recipe="opened" :level="levelOf(opened)" @close="opened = null" />
  </div>
</template>
