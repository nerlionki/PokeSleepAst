<script setup lang="ts">
import paths from '../../../../core/src/ui/tab-icons.json'
defineProps<{ name: keyof typeof paths }>()
</script>

<template>
  <svg class="tab-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
    <path v-for="(path, index) in paths[name]" :key="index" :d="path" />
  </svg>
</template>

<style scoped>
.tab-ico { display: block; width: 22px; height: 22px; }
</style>
