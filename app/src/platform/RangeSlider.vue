<script setup lang="ts">
withDefaults(defineProps<{
  modelValue: number
  min?: number
  max?: number
  step?: number
  disabled?: boolean
}>(), { min: 0, max: 100, step: 1 })
const emit = defineEmits<{ 'update:modelValue': [value: number]; change: [value: number] }>()

function readValue(event: Event) {
  return (event.currentTarget as HTMLInputElement).valueAsNumber
}
</script>

<template>
  <input
    type="range"
    :value="modelValue"
    :min="min"
    :max="max"
    :step="step"
    :disabled="disabled"
    @input="emit('update:modelValue', readValue($event))"
    @change="emit('change', readValue($event))"
    @touchstart.stop
    @touchend.stop
    @touchcancel.stop
  >
</template>
