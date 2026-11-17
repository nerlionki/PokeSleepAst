<script setup lang="ts">
import { gameText, t as translateUi } from '../../ui/i18n'
import clientDefaults from '../../data/client-defaults.resource'

import { computed, shallowRef, watch } from 'vue'
import { POT_TIERS } from '../../calc/data'
import { RECIPE_CATALOG, recipeDisplayLevelKey, type RecipeDisplayRow } from '../../calc/recipeCatalog'
import { compareRecipeEnergyDescending } from '../../calc/recipes'
import type { MealCategorySelection } from '../../types'
import { recipeLevelOf } from '../../calc/cook'
import { cookingPotCapacity } from '../../calc/cookingSkillState'
import { useSettingsStore } from '../../stores/settings'
import { textHit } from '../../calc/text'
import RecipeCard from './RecipeCard.vue'
import RecipeCategoryTabs from './RecipeCategoryTabs.vue'
import RecipeSheet from './RecipeSheet.vue'
const components_data_PotPane_config_clientDefaults = clientDefaults.modules.components_data_PotPane


const props = defineProps<{ q: string }>()
const store = useSettingsStore()
const minimumIndex = computed(() => {
  const at = POT_TIERS.findIndex(row => row.pot >= store.settings.potSize)
  return at < 0 ? POT_TIERS.length : at
})
const index = shallowRef(components_data_PotPane_config_clientDefaults["indexInitial"])
watch(minimumIndex, at => { index.value = at }, { immediate: true })
const category = shallowRef<MealCategorySelection>((components_data_PotPane_config_clientDefaults.categoryViewInitial ?? 'all') as MealCategorySelection)
const opened = shallowRef<RecipeDisplayRow | null>((components_data_PotPane_config_clientDefaults["openedInitial"] as unknown as RecipeDisplayRow | null))

const tier = computed(() => POT_TIERS[index.value])
const nextTier = computed(() => POT_TIERS[index.value + 1])
const capacityFor = (base: number) => cookingPotCapacity(base, false, store.settings.goodCamp, 0)
const capacity = computed(() => capacityFor(tier.value?.pot ?? store.settings.potSize))
const maxCapacity = computed(() => capacityFor(Math.max(store.settings.potSize, POT_TIERS[POT_TIERS.length - 1]!.pot)))

function spent(upto: number) {
  return POT_TIERS.slice(0, upto + 1).reduce((sum, row) => sum + row.shards, 0)
}

const recipes = computed(() => RECIPE_CATALOG.filter(recipe => {
  if (recipe.announcementKey && !(recipe.pot > 0)) return false
  if (category.value !== 'all' && recipe.category !== category.value) return false
  const searchable = [recipe.name, ...recipe.ingredients.map(ingredient => ingredient.name)]
  return searchable.some(name => textHit(name, props.q) || textHit(gameText(name), props.q))
}))
const openedLevelKey = computed(() => opened.value ? recipeDisplayLevelKey(opened.value) : null)

function levelOf(recipe: RecipeDisplayRow) {
  const key = recipeDisplayLevelKey(recipe)
  return key == null ? undefined : recipeLevelOf(store.settings, key)
}

function updateLevel(level: number) {
  if (openedLevelKey.value != null) store.setRecipeLevel(openedLevelKey.value, level)
}

const ready = computed(() => recipes.value
  .filter((r) => r.pot <= capacity.value)
  .sort(compareRecipeEnergyDescending))

const overflow = computed(() => recipes.value.filter((r) => r.pot > maxCapacity.value).sort(compareRecipeEnergyDescending))

const later = computed(() => POT_TIERS.slice(index.value + 1).map((row, offset) => {
  const at = index.value + 1 + offset
  const prev = capacityFor(POT_TIERS[at - 1]!.pot)
  const pot = capacityFor(row.pot)
  return {
    pot,
    recipes: recipes.value
      .filter((r) => r.pot > prev && r.pot <= pot)
      .sort(compareRecipeEnergyDescending),
  }
}).filter(block => block.recipes.length))

function shift(step: number) {
  index.value = Math.min(POT_TIERS.length - 1, Math.max(minimumIndex.value, index.value + step))
}
</script>

<template>
  <div class="stack">
    <div class="pot-bar">
      <button type="button" :aria-label="translateUi('上一档')" :disabled="index <= minimumIndex" @click="shift(-1)">‹</button>
      <div>
        <strong>{{ translateUi("容量") }} {{ capacity }}{{ store.settings.goodCamp ? ' · ' + translateUi('露营券') : '' }}</strong>
        <em v-if="tier">{{ translateUi("累计梦碎 {arg1}", { arg1: String(spent(index).toLocaleString('zh-CN')) }) }}</em>
        <em v-if="nextTier">{{ translateUi("升至容量") }} {{ capacityFor(nextTier.pot) }} {{ translateUi("需梦碎") }} {{ nextTier.shards.toLocaleString('zh-CN') }}</em>
        <em v-else-if="tier">{{ translateUi("已达最高锅容量") }}</em>
      </div>
      <button type="button" :aria-label="translateUi('下一档')" :disabled="!nextTier" @click="shift(1)">›</button>
    </div>
    <RecipeCategoryTabs v-model="category" />
    <p class="muted">{{ translateUi("食谱等级使用全局设置，点击食谱可调整，即时生效。") }}</p>
    <p class="muted">{{ translateUi("当前可做") }} {{ ready.length }} {{ translateUi("道") }}</p>
    <div class="meal-grid">
      <RecipeCard v-for="r in ready" :key="r.id > 0 ? r.id : r.announcementKey" :recipe="r" :level="levelOf(r)" @open="opened = r" />
    </div>
    <section v-for="block in later" :key="block.pot" class="pot-next">
      <p>
        <strong>{{ translateUi("锅") }} {{ block.pot }}</strong>
      </p>
      <div class="meal-grid">
        <RecipeCard v-for="r in block.recipes" :key="r.id > 0 ? r.id : r.announcementKey" :recipe="r" :level="levelOf(r)" @open="opened = r" />
      </div>
    </section>
    <section v-if="overflow.length" class="pot-next">
      <p>
        <strong>{{ translateUi("锅容量") }} &gt; {{ maxCapacity }}</strong>
      </p>
      <div class="meal-grid">
        <RecipeCard v-for="r in overflow" :key="r.id > 0 ? r.id : r.announcementKey" :recipe="r" :level="levelOf(r)" @open="opened = r" />
      </div>
    </section>
    <RecipeSheet v-if="opened" :recipe="opened" :level="levelOf(opened)" :editable-level="openedLevelKey != null" @update:level="updateLevel" @close="opened = null" />
  </div>
</template>
