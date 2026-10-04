<script setup lang="ts">
import { MEAL_CATEGORIES, RECIPE_LEVELS, bonusLabel, dishEnergy, type RecipeRow } from '../../calc/recipes'
import DrawerSheet from '../shared/DrawerSheet.vue'
import IngredientIcon from '../shared/IngredientIcon.vue'
import MealIcon from '../shared/MealIcon.vue'

defineProps<{
  recipe: RecipeRow
  level: number
}>()

defineEmits<{ close: [] }>()

function categoryLabel(id: string) {
  return MEAL_CATEGORIES.find((c) => c.id === id)?.label ?? id
}
</script>

<template>
  <DrawerSheet :title="recipe.name" @close="$emit('close')">
    <div class="row">
      <MealIcon :name="recipe.name" />
      <div>
        <p>{{ categoryLabel(recipe.category) }} · 锅 {{ recipe.pot || '不限' }}</p>
        <p class="muted">{{ bonusLabel(recipe.bonus) }}</p>
      </div>
    </div>
    <div v-if="recipe.ingredients.length" class="stack">
      <div v-for="ing in recipe.ingredients" :key="ing.id" class="row">
        <IngredientIcon :id="ing.id" :name="ing.name" />
        <span>{{ ing.name }} × {{ ing.count }}</span>
      </div>
    </div>
    <p v-else class="muted">拌拌食谱，用当餐剩下的食材。</p>
    <div class="energy-table">
      <div v-for="lv in RECIPE_LEVELS" :key="lv" class="energy-row" :class="{ on: lv === level }">
        <span>Lv.{{ lv }}</span>
        <strong>{{ dishEnergy(recipe.baseEnergy, lv).toLocaleString('zh-CN') }}</strong>
      </div>
    </div>
  </DrawerSheet>
</template>
