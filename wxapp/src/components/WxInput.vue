<script setup lang="ts">
import { computed } from 'vue'
const props = defineProps<{ modelValue?: unknown; value?: unknown; type?: string; min?: string | number; max?: string | number; step?: string | number; placeholder?: string; disabled?: boolean; modelModifiers?: { number?: boolean; trim?: boolean } }>()
const emit = defineEmits<{ 'update:modelValue': [value: unknown]; change: [event: { target: { value: unknown; checked?: boolean } }]; input: [event: { target: { value: unknown } }] }>()
const current = computed(() => props.modelValue ?? props.value ?? '')
const sliderScale = computed(() => 10 ** Math.min(6, (String(props.step ?? 1).split('.')[1] ?? '').length))
function change(event: unknown) {
  let value = (event as { detail: { value: unknown } }).detail.value
  if (props.type === 'range') value = Number(value) / sliderScale.value
  if (props.modelModifiers?.trim && typeof value === 'string') value = value.trim()
  if (props.modelModifiers?.number && value !== '') { const n = Number(value); if (Number.isFinite(n)) value = n }
  emit('update:modelValue', value); emit('input', { target: { value } }); emit('change', { target: { value, checked: typeof value === 'boolean' ? value : undefined } })
}
</script>
<template>
  <switch v-if="type === 'checkbox'" :checked="Boolean(current)" :disabled="disabled" color="#7fcec0" @change="change" />
  <slider v-else-if="type === 'range'" :value="Math.round(Number(current) * sliderScale)" :min="Math.round(Number(min ?? 0) * sliderScale)" :max="Math.round(Number(max ?? 100) * sliderScale)" :step="Math.max(1, Math.round(Number(step ?? 1) * sliderScale))" active-color="#7fcec0" @change="change" />
  <picker v-else-if="type === 'time'" mode="time" :value="String(current)" @change="change"><view>{{ current || '选择时间' }}</view></picker>
  <input v-else :type="type === 'number' ? 'digit' : 'text'" :value="String(current)" :placeholder="placeholder" :disabled="disabled" @input="change" />
</template>
