<script setup lang="ts" generic="T extends string">
import { taskNavigationLocked } from '../../composables/taskNavigationLock'
import SegmentedControl from './SegmentedControl.vue'
withDefaults(defineProps<{
  options: readonly { id: T, label: string, disabled?: boolean }[]
  disabled?: boolean
}>(), { disabled: false })
const model = defineModel<T>({ required: true })
</script>

<template>
  <SegmentedControl v-model="model" :options="options" :disabled="disabled || taskNavigationLocked" />
</template>
