<script setup lang="ts">
import clientDefaults from '../../data/client-defaults.resource'
import { cloneData } from '../../calc/dataClone'

import { computed } from 'vue'
import FallbackImage from './FallbackImage.vue'
import { berryIconUrl } from '../../calc/berry'
import { berryByName } from '../../calc/data'
const components_shared_BerryIcon_config_clientDefaults = clientDefaults.modules.components_shared_BerryIcon


const props = defineProps<{
  name: string
  large?: boolean
  small?: boolean
}>()

const berry = computed(() => berryByName(props.name))
const hue = computed(() => {
  const map: Record<string, number> = (cloneData(components_shared_BerryIcon_config_clientDefaults["map"]) as unknown as Record<string, number>)
  return map[berry.value?.type ?? ''] ?? 40
})

</script>

<template>
  <FallbackImage class="berry-icon" :class="{ lg: large, sm: small }" :src="berryIconUrl(name)" :alt="name" :reset-key="name">
    <template #fallback>
      <span class="berry-fallback" :class="{ lg: large, sm: small }" :style="{ background: `hsl(${hue} 55% 42%)` }" :title="name">{{ name.slice(0, 1) }}</span>
    </template>
  </FallbackImage>
</template>
