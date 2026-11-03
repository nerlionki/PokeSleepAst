<script setup lang="ts" generic="T extends number | null">
withDefaults(defineProps<{ levels: readonly number[], allowOriginal?: boolean, disabled?: boolean }>(), { allowOriginal: false, disabled: false })
const model = defineModel<T>({ required: true })
// The original-level button is optional; numeric-only editors never emit null.
function select(value: number | null) { model.value = value as T }
</script>

<template>
  <div class="lv-row" role="group" aria-label="等级选择">
    <span class="muted">LV</span>
    <button v-if="allowOriginal" type="button" :disabled="disabled" :aria-pressed="model === null" :class="{ on: model === null }" @click="select(null)">原级</button>
    <button v-for="level in levels" :key="level" type="button" :disabled="disabled" :aria-pressed="model === level" :class="{ on: model === level }" @click="select(level)">{{ level }}</button>
  </div>
</template>
