<script setup lang="ts">
import { useAppearanceStore } from '../../../core/src/stores/appearance'

const appearance = useAppearanceStore()
</script>

<template>
  <root-portal>
    <view :style="appearance.variables" class="portal-appearance"><slot /></view>
  </root-portal>
</template>

<style>
.portal-appearance { color: var(--text); font-family: var(--font-family, sans-serif); font-size: var(--font-16); }
</style>
