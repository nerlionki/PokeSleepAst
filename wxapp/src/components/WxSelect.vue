<script setup lang="ts">
import { computed, useSlots, type VNode } from 'vue'
const props = defineProps<{ modelValue?: unknown; value?: unknown; modelModifiers?: { number?: boolean }; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: unknown]; change: [event: { target: { value: unknown } }] }>()
const slots = useSlots()
function options(nodes: VNode[]): Array<{ label: string; value: unknown }> {
  return nodes.flatMap(node => {
    if (Array.isArray(node.children) && node.type !== 'option') return options(node.children as VNode[])
    if (node.type !== 'option') return []
    const label = Array.isArray(node.children) ? node.children.map(child => typeof child === 'object' && child ? (child as VNode).children ?? '' : child).join('') : String(node.children ?? '')
    return [{ label, value: node.props?.value ?? label }]
  })
}
const items = computed(() => options(slots.default?.() ?? []))
const selected = computed(() => Math.max(0, items.value.findIndex(item => String(item.value) === String(props.modelValue ?? props.value))))
function change(event: { detail: { value: number | string } }) {
  const item = items.value[Number(event.detail.value)]
  if (!item) return
  const value = props.modelModifiers?.number ? Number(item.value) : item.value
  emit('update:modelValue', value); emit('change', { target: { value } })
}
</script>
<template><picker :range="items" range-key="label" :value="selected" :disabled="disabled" @change="change"><view class="wx-select">{{ items[selected]?.label ?? '请选择' }} ▾</view></picker></template>
