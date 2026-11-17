<script setup lang="ts">
import { MEAL_CATEGORIES } from '../../calc/recipes'
import type { MealCategorySelection } from '../../types'
import { t } from '../../ui/i18n'

const category = defineModel<MealCategorySelection>({ required: true })
const categories = [{ id: 'all', label: '全部' } as const, ...MEAL_CATEGORIES]
</script>

<template>
  <div class="seg recipe-category-tabs">
    <button
      v-for="item in categories"
      :key="item.id"
      type="button"
      :class="{ on: category === item.id }"
      :aria-pressed="category === item.id"
      @click="category = item.id"
    >{{ t(item.label) }}</button>
  </div>
</template>

<style scoped>
.recipe-category-tabs {
  grid-template-columns: minmax(0, 3fr) minmax(0, 5fr) minmax(0, 3fr) minmax(0, 5fr);
  gap: 4px;
}

.recipe-category-tabs button {
  padding: 8px 4px;
  font-size: var(--font-13);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

@media (max-width: 350px) {
  .recipe-category-tabs {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
