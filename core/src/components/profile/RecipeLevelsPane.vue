<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { recipeLevelOf, RECIPE_LEVEL_MAX } from '../../calc/cook'
import { RECIPE_CATALOG, recipeDisplayLevelKey } from '../../calc/recipeCatalog'
import { compareRecipeEnergyDescending } from '../../calc/recipes'
import { INPUT_RANGES } from '../../calc/inputRanges'
import { useSettingsStore } from '../../stores/settings'
import type { MealCategorySelection } from '../../types'
import { gameText, t } from '../../ui/i18n'
import RecipeCategoryTabs from '../data/RecipeCategoryTabs.vue'
import MealIcon from '../shared/MealIcon.vue'

const store = useSettingsStore()
const category = shallowRef<MealCategorySelection>('all')
const levelMin = INPUT_RANGES.SettingsPanel.recipeLevelOf_settings_r_name.min
const recipes = computed(() => RECIPE_CATALOG
  .filter(recipe => !recipe.mix && (category.value === 'all' || recipe.category === category.value))
  .sort(compareRecipeEnergyDescending)
  .map(recipe => ({ ...recipe, levelKey: recipeDisplayLevelKey(recipe) })))

function updateLevel(id: number, event: Event) {
  const value = (event.target as HTMLInputElement).value
  if (value === '') store.clearRecipeLevel(id)
  else store.setRecipeLevel(id, Number(value))
}
</script>

<template>
  <section class="card stack">
    <p class="muted">{{ t('未单独设置的食谱跟随全局食谱等级。') }}</p>
    <RecipeCategoryTabs v-model="category" />
    <div v-for="(level, key) in store.settings.unresolvedRecipeLevels" :key="key" class="row">
      <span class="amber">{{ key }} · Lv.{{ level }} · {{ t('旧食谱等级未匹配或冲突') }}</span>
      <button type="button" class="btn ghost" @click="store.removeUnresolvedRecipeLevel(key)">{{ t('删除') }}</button>
    </div>
    <div class="recipe-levels">
      <div v-for="recipe in recipes" :key="recipe.id > 0 ? recipe.id : recipe.announcementKey" class="recipe-lv-row">
        <MealIcon :name="recipe.name" :id="recipe.id" />
        <div class="recipe-level-name">
          <span>{{ gameText(recipe.name) }}</span>
          <button
            v-if="recipe.levelKey != null && store.settings.recipeLevels[recipe.levelKey] != null"
            type="button"
            class="btn ghost recipe-level-reset"
            @click="store.clearRecipeLevel(recipe.id)"
          >{{ t('跟随全局设置') }}</button>
        </div>
        <input
          v-if="recipe.levelKey != null"
          :value="recipeLevelOf(store.settings, recipe.levelKey)"
          :aria-label="gameText(recipe.name)"
          type="number"
          :min="levelMin"
          :max="RECIPE_LEVEL_MAX"
          @change="updateLevel(recipe.id, $event)"
        />
        <span v-else class="muted">—</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.recipe-level-name { display: grid; gap: 4px; min-width: 0; }
.recipe-level-reset { justify-self: start; font-size: var(--font-12); }
</style>
