<script setup lang="ts">
import { ingredientImageUrl, mealImageUrl } from '../../calc/raeImage'
import FallbackImage from './FallbackImage.vue'
defineProps<{ name: string, imageFile?: string }>()
</script>

<template>
  <FallbackImage class="rae-icon meal" :src="mealImageUrl(name, imageFile) || ingredientImageUrl(0)" :alt="name" :reset-key="name" />
</template>
