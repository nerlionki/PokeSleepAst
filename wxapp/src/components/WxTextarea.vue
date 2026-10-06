<script setup lang="ts">
const props = defineProps<{ modelValue?: string; placeholder?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
function input(event: unknown) { emit('update:modelValue', (event as { detail: { value: string } }).detail.value) }
</script>
<template><textarea class="wx-control wx-textarea" :value="props.modelValue ?? ''" :placeholder="placeholder" :maxlength="-1" auto-height @input="input" /></template>
