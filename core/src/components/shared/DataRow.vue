<script setup lang="ts">
import { t as translateUi } from '../../ui/i18n'

defineProps<{
  title: string
  subtitle?: string
}>()
</script>

<template>
  <button type="button" class="data-row" :class="{ 'no-lead': !$slots.lead }">
    <div v-if="$slots.lead" class="data-row-lead"><slot name="lead" /></div>
    <span class="data-row-txt">
      <strong>{{ translateUi(title) }}</strong>
      <em v-if="subtitle">{{ subtitle }}</em>
      <slot />
    </span>
    <slot name="trail">
      <span class="data-row-chev" aria-hidden="true">›</span>
    </slot>
  </button>
</template>
