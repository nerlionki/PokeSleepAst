<script setup lang="ts">
import { ingredientImageUrl } from '../../calc/raeImage'
import FallbackImage from './FallbackImage.vue'
defineProps<{ id: number, name: string, small?: boolean }>()
</script>

<template>
  <FallbackImage class="rae-icon" :class="{ sm: small }" :src="ingredientImageUrl(id)" :alt="name" :reset-key="id">
    <template #fallback><span class="ing-mark" :class="{ sm: small }">{{ name.slice(0, 1) }}</span></template>
  </FallbackImage>
</template>
