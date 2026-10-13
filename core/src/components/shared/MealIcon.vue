<script setup lang="ts">
import { mealImageUrl } from '../../calc/raeImage'
import FallbackImage from './FallbackImage.vue'
defineProps<{ name: string }>()
</script>

<template>
  <FallbackImage class="rae-icon meal" :src="mealImageUrl(name)" :alt="name" :reset-key="name" />
</template>
