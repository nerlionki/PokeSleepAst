<script setup lang="ts">
defineProps<{
  title: string
  subtitle?: string
}>()
</script>

<template>
  <button type="button" class="data-row" :class="{ 'no-lead': !$slots.lead }">
    <span v-if="$slots.lead" class="data-row-lead"><slot name="lead" /></span>
    <span class="data-row-txt">
      <strong>{{ title }}</strong>
      <em v-if="subtitle">{{ subtitle }}</em>
      <slot />
    </span>
    <slot name="trail">
      <span class="data-row-chev" aria-hidden="true">›</span>
    </slot>
  </button>
</template>
