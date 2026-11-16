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
.portal-appearance {
  --radius-control: 12px;
  --control-padding: 10px 12px;
  --rarity-gold: var(--amber);
  --rarity-blue: var(--sage);
  color: var(--text);
  font-family: var(--font-family, sans-serif);
  font-size: var(--font-16);
}
</style>
