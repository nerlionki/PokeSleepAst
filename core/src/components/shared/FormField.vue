<script setup lang="ts">
import { useId } from 'vue'
const props = defineProps<{ label?: string, id?: string }>()
const generatedId = useId()
</script>

<template>
  <div class="field">
    <label v-if="label || $slots.label" :for="props.id ?? generatedId"><slot name="label">{{ label }}</slot></label>
    <slot :id="props.id ?? generatedId" />
  </div>
</template>
