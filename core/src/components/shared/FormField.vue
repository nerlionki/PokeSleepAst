<script setup lang="ts">
import { t as translateUi } from '../../ui/i18n'
import { useId } from 'vue'
const props = defineProps<{ label?: string, id?: string }>()
const generatedId = useId()
</script>

<template>
  <div class="field">
    <label v-if="label || $slots.label" :for="props.id ?? generatedId"><slot name="label">{{ translateUi(label) }}</slot></label>
    <slot :id="props.id ?? generatedId" />
  </div>
</template>
