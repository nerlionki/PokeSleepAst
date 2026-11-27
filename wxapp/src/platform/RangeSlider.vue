<script setup lang="ts">
import { computed } from 'vue'
import { useAppearanceStore } from '../../../core/src/stores/appearance'

const props = withDefaults(defineProps<{
  modelValue: number
  min?: number
  max?: number
  step?: number
  disabled?: boolean
}>(), { min: 0, max: 100, step: 1 })
const emit = defineEmits<{ 'update:modelValue': [value: number]; change: [value: number] }>()
const appearance = useAppearanceStore()
const scale = computed(() => 10 ** Math.min(6, (String(props.step).split('.')[1] ?? '').length))
const minimum = computed(() => Math.round(props.min * scale.value))
const maximum = computed(() => Math.round(props.max * scale.value))

function clamp(position: number) {
  return Math.min(maximum.value, Math.max(minimum.value, position))
}

function change(event: { detail: { value: number } }) {
  const position = Number(event.detail.value)
  if (props.disabled || !Number.isFinite(position)) return
  const value = clamp(position) / scale.value
  emit('update:modelValue', value)
  emit('change', value)
}
</script>

<template>
  <view class="wx-range-control" @touchstart.stop @touchmove.stop @touchend.stop @touchcancel.stop>
    <slider
      class="wx-range"
      :disabled="disabled"
      :value="clamp(Math.round(modelValue * scale))"
      :min="minimum"
      :max="maximum"
      :step="Math.max(1, Math.round(step * scale))"
      :block-size="24"
      :background-color="appearance.palette.line"
      :active-color="appearance.palette.amber"
      @changing="change"
      @change="change"
    />
  </view>
</template>

<style>
.wx-range-control { display: block; flex: 1; width: 100%; min-width: 0; padding: 0 20px; }
.wx-range { display: block; width: 100%; min-width: 0; margin: 10px 0; }
</style>
