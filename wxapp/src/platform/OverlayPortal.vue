<script setup lang="ts">
import { useAppearanceStore } from '../../../core/src/stores/appearance'
import { computed } from 'vue'
import { useViewport } from './viewport'
import { viewportVariables } from '../../../core/src/ui/responsive'

const appearance = useAppearanceStore()
const viewport = useViewport()
const variables = computed(() => ({ ...appearance.variables, ...viewportVariables(viewport.value),
  '--safe-left': `${viewport.value.safeLeft}px`, '--safe-right': `${viewport.value.safeRight}px`,
  '--safe-bottom': `${viewport.value.safeBottom}px`, '--safe-top': '0px' }))
</script>

<template>
  <root-portal>
    <view :style="variables" class="portal-appearance"><slot /></view>
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
