<script setup lang="ts">
import { t as translateUi } from '../../../core/src/ui/i18n'
import { computed } from 'vue'
import { useAppearanceStore } from '../../../core/src/stores/appearance'
const appearance = useAppearanceStore()
const props = defineProps<{ modelValue?: unknown; value?: unknown; checked?: boolean; type?: string; min?: string | number; max?: string | number; step?: string | number; placeholder?: string; disabled?: boolean; modelModifiers?: { number?: boolean; trim?: boolean } }>()
const emit = defineEmits<{ 'update:modelValue': [value: unknown]; change: [event: { target: { value: unknown; checked?: boolean } }]; input: [event: { target: { value: unknown } }] }>()
const current = computed(() => props.modelValue ?? (props.type === 'checkbox' ? props.checked : undefined) ?? props.value ?? '')

function change(event: unknown) {
  if (props.disabled) return
  let value = (event as { detail: { value: unknown } }).detail.value
  if (props.modelModifiers?.trim && typeof value === 'string') value = value.trim()
  if (props.modelModifiers?.number && value !== '') { const n = Number(value); if (Number.isFinite(n)) value = n }
  emit('update:modelValue', value); emit('input', { target: { value } }); emit('change', { target: { value, checked: typeof value === 'boolean' ? value : undefined } })
}
</script>
<template>
  <view v-if="type === 'checkbox'" class="wx-switch-control"><switch @touchstart.stop @touchend.stop @touchcancel.stop :checked="Boolean(current)" :disabled="disabled" :color="appearance.palette.amber" @change="change" /></view>
  <picker @touchstart.stop @touchend.stop @touchcancel.stop v-else-if="type === 'time'" class="wx-control" mode="time" :disabled="disabled" :value="String(current)" @change="change"><view class="wx-select">{{ current || translateUi("选择时间") }}</view></picker>
  <input @touchstart.stop @touchend.stop @touchcancel.stop v-else class="wx-control wx-input" :adjust-position="false" :cursor-spacing="12" :type="type === 'number' ? 'digit' : 'text'" :value="String(current)" :placeholder="placeholder" :disabled="disabled" @input="change" />
</template>
<style>
.wx-switch-control { display: inline-flex; align-items: center; flex: none; width: 52px; height: 32px; }
</style>
