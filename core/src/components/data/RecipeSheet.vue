<script setup lang="ts">
import { INPUT_RANGES } from '../../calc/inputRanges'
const INPUT_LIMITS = INPUT_RANGES.RecipeSheet

  import type { RecipeDisplayRow } from '../../calc/recipeCatalog';
  import { RECIPE_LEVEL_MAX } from '../../calc/cook';
  import {
    MEAL_CATEGORIES,
    RECIPE_LEVELS,
    bonusLabel,
    dishEnergy
  } from '../../calc/recipes';
  import DrawerSheet from '../shared/DrawerSheet.vue';
  import IngredientIcon from '../shared/IngredientIcon.vue';
  import MealIcon from '../shared/MealIcon.vue';

  defineProps<{
    recipe: RecipeDisplayRow;
    level?: number;
    editableLevel?: boolean;
  }>();

  const emit = defineEmits<{ close: []; 'update:level': [level: number] }>();

  function editLevel(event: { target: unknown }) {
    const raw = String((event.target as { value: unknown }).value).trim();
    if (raw && Number.isFinite(Number(raw))) emit('update:level', Number(raw));
  }

  function categoryLabel(id: string) {
    return MEAL_CATEGORIES.find(c => c.id === id)?.label ?? id;
  }
</script>

<template>
  <DrawerSheet :title="recipe.name" @close="$emit('close')">
    <div class="row">
      <MealIcon :name="recipe.name" :id="recipe.id" />
      <div>
        <p>
          {{ categoryLabel(recipe.category) }} · 锅 {{ recipe.pot || '不限' }}
        </p>
        <p class="muted">
          {{ recipe.bonus == null ? '还未公布' : bonusLabel(recipe.bonus) }}
        </p>
      </div>
    </div>
    <p v-if="recipe.nameUnannounced" class="muted">食谱名称还未公布</p>
    <div v-if="recipe.ingredients.length" class="stack">
      <div v-for="ing in recipe.ingredients" :key="ing.name" class="row">
        <IngredientIcon :id="ing.id" :name="ing.name" />
        <span>{{ ing.name }} × {{ ing.count ?? '还未公布' }}</span>
      </div>
    </div>
    <p v-else class="muted">拌拌食谱，用当餐剩下的食材。</p>
    <label v-if="editableLevel && !recipe.mix" class="field">
      <span>食谱等级（同步全局设置）</span>
      <input
        :value="level"
        type="number"
        :min="INPUT_LIMITS.level.min"
        :max="RECIPE_LEVEL_MAX"
        :step="INPUT_LIMITS.level.step"
        @input="editLevel"
      />
    </label>
    <div class="energy-table">
      <div
        v-for="lv in RECIPE_LEVELS"
        :key="lv"
        class="energy-row"
        :class="{ on: lv === level }"
      >
        <span>Lv.{{ lv }}</span>
        <strong>{{
          recipe.baseEnergy == null
            ? '还未公布'
            : dishEnergy(recipe.baseEnergy, lv).toLocaleString('zh-CN')
        }}</strong>
      </div>
    </div>
  </DrawerSheet>
</template>
