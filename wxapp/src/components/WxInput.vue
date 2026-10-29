<script setup lang="ts">
import { computed } from 'vue'
import { useAppearanceStore } from '../../../core/src/stores/appearance'
const appearance = useAppearanceStore()
const props = defineProps<{ modelValue?: unknown; value?: unknown; checked?: boolean; type?: string; min?: string | number; max?: string | number; step?: string | number; placeholder?: string; disabled?: boolean; modelModifiers?: { number?: boolean; trim?: boolean } }>()
const emit = defineEmits<{ 'update:modelValue': [value: unknown]; change: [event: { target: { value: unknown; checked?: boolean } }]; input: [event: { target: { value: unknown } }] }>()
const current = computed(() => props.modelValue ?? (props.type === 'checkbox' ? props.checked : undefined) ?? props.value ?? '')
const sliderScale = computed(() => 10 ** Math.min(6, (String(props.step ?? 1).split('.')[1] ?? '').length))
function change(event: unknown) {
  if (props.disabled) return
  let value = (event as { detail: { value: unknown } }).detail.value
  if (props.type === 'range') value = Number(value) / sliderScale.value
  if (props.modelModifiers?.trim && typeof value === 'string') value = value.trim()
  if (props.modelModifiers?.number && value !== '') { const n = Number(value); if (Number.isFinite(n)) value = n }
  emit('update:modelValue', value); emit('input', { target: { value } }); emit('change', { target: { value, checked: typeof value === 'boolean' ? value : undefined } })
}
</script>
<template>
  <view v-if="type === 'checkbox'" class="wx-switch-control"><switch :checked="Boolean(current)" :disabled="disabled" :color="appearance.palette.amber" @change="change" /></view>
  <slider v-else-if="type === 'range'" class="wx-range" :disabled="disabled" :value="Math.round(Number(current) * sliderScale)" :min="Math.round(Number(min ?? 0) * sliderScale)" :max="Math.round(Number(max ?? 100) * sliderScale)" :step="Math.max(1, Math.round(Number(step ?? 1) * sliderScale))" :active-color="appearance.palette.amber" @change="change" @changing="change" />
  <picker v-else-if="type === 'time'" class="wx-control" mode="time" :disabled="disabled" :value="String(current)" @change="change"><view class="wx-select">{{ current || '选择时间' }}</view></picker>
  <input v-else class="wx-control wx-input" :type="type === 'number' ? 'digit' : 'text'" :value="String(current)" :placeholder="placeholder" :disabled="disabled" @input="change" />
</template>
<style>
.wx-switch-control { display: inline-flex; align-items: center; flex: none; width: 52px; height: 32px; }
.wx-range { display: block; flex: 1; width: 100%; min-width: 0; margin: 10px 0; }
</style>
