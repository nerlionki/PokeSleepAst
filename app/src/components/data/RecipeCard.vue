<script setup lang="ts">
import { bonusLabel, dishEnergy, type RecipeRow } from '../../calc/recipes'
import IngredientIcon from '../shared/IngredientIcon.vue'
import MealIcon from '../shared/MealIcon.vue'

defineProps<{
  recipe: RecipeRow
  level: number
}>()

defineEmits<{ open: [] }>()
</script>

<template>
  <button type="button" class="meal-card" @click="$emit('open')">
    <span class="meal-card-head">
      <strong>{{ recipe.name }}</strong>
      <MealIcon :name="recipe.name" />
    </span>
    <span class="meal-card-meta">{{ bonusLabel(recipe.bonus) }}</span>
    <span class="meal-card-energy">
      {{ recipe.baseEnergy.toLocaleString('zh-CN') }}
      <template v-if="level > 1"> → {{ dishEnergy(recipe.baseEnergy, level).toLocaleString('zh-CN') }}</template>
      @ Lv.{{ level }}
    </span>
    <span class="meal-card-ings">
      <em class="pot-badge">{{ recipe.pot }}</em>
      <span v-for="ing in recipe.ingredients" :key="ing.id" class="meal-ing">
        <IngredientIcon :id="ing.id" :name="ing.name" small />
        <i>{{ ing.count }}</i>
      </span>
      <span v-if="!recipe.ingredients.length" class="muted">剩余食材</span>
    </span>
  </button>
</template>
