<script setup lang="ts">
import { gameText } from '../../ui/i18n'
  import { ingredientImageUrl, mealImageUrl } from '../../calc/raeImage';
  import FallbackImage from './FallbackImage.vue';
  defineProps<{ name: string; id?: number }>();
</script>

<template>
  <FallbackImage
    class="rae-icon meal"
    :src="mealImageUrl(name, id) || ingredientImageUrl(0)"
    :alt="gameText(name)"
    :reset-key="`${id ?? ''}:${name}`"
  />
</template>
