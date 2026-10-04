<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { mealImageUrl } from '../../calc/raeImage'

const props = defineProps<{ name: string }>()
const failed = shallowRef(false)
const src = computed(() => mealImageUrl(props.name))
watch(() => props.name, () => { failed.value = false })
</script>

<template>
  <img
    v-if="src && !failed"
    class="rae-icon meal"
    :src="src"
    :alt="name"
    @error="failed = true"
  >
</template>
