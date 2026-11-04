<script setup lang="ts">
import { bonusLabel, dishEnergy } from '../../calc/recipes'
import type { RecipeDisplayRow } from '../../calc/recipeCatalog'
import { RECIPE_LEVEL_MAX } from '../../calc/cook'
import IngredientIcon from '../shared/IngredientIcon.vue'
import MealIcon from '../shared/MealIcon.vue'

defineProps<{
  recipe: RecipeDisplayRow
  level?: number
}>()

defineEmits<{ open: [] }>()
</script>

<template>
  <button type="button" class="meal-card" @click="$emit('open')">
    <span class="meal-card-head">
      <strong>{{ recipe.name }}</strong>
      <MealIcon :name="recipe.name" :image-file="recipe.imageFile" />
    </span>
    <span class="meal-card-meta">{{ recipe.bonus == null ? '还未公布' : bonusLabel(recipe.bonus) }}</span>
    <span class="meal-card-energy">
      <template v-if="recipe.baseEnergy == null">还未公布</template>
      <template v-else-if="level == null">
        满级（Lv.{{ RECIPE_LEVEL_MAX }}）{{ dishEnergy(recipe.baseEnergy, RECIPE_LEVEL_MAX).toLocaleString('zh-CN') }}
      </template>
      <template v-else>
        {{ recipe.baseEnergy.toLocaleString('zh-CN') }}
        <template v-if="level > 1"> → {{ dishEnergy(recipe.baseEnergy, level).toLocaleString('zh-CN') }}</template>
        @ Lv.{{ level }}
      </template>
    </span>
    <span class="meal-card-ings">
      <em class="pot-badge">{{ recipe.pot }}</em>
      <span v-for="ing in recipe.ingredients" :key="ing.name" class="meal-ing">
        <IngredientIcon :id="ing.id" :name="ing.name" small />
        <i>{{ ing.count ?? '还未公布' }}</i>
      </span>
      <span v-if="!recipe.ingredients.length" class="muted">剩余食材</span>
    </span>
  </button>
</template>
