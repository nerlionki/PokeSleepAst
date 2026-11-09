<script setup lang="ts">
import { gameText } from '../../ui/i18n'
import { ingredientImageUrl } from '../../calc/raeImage'
import FallbackImage from './FallbackImage.vue'
defineProps<{ id: number, name: string, small?: boolean, imageFile?: string }>()
</script>

<template>
  <FallbackImage class="rae-icon" :class="{ sm: small }" :src="ingredientImageUrl(id, name, imageFile)" :alt="gameText(name)" :reset-key="`${id}:${name}:${imageFile ?? ''}`">
    <template #fallback><span class="ing-mark" :class="{ sm: small }">{{ gameText(name).slice(0, 1) }}</span></template>
  </FallbackImage>
</template>
