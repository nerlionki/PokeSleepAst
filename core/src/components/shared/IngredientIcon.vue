<script setup lang="ts">
import { shallowRef, watch } from 'vue'
import { ingredientImageUrl } from '../../calc/raeImage'

const props = defineProps<{
  id: number
  name: string
  small?: boolean
}>()

const failed = shallowRef(false)
watch(() => props.id, () => { failed.value = false })
</script>

<template>
  <img
    v-if="!failed"
    class="rae-icon"
    :class="{ sm: small }"
    :src="ingredientImageUrl(id)"
    :alt="name"
    @error="failed = true"
  >
  <span v-else class="ing-mark" :class="{ sm: small }">{{ name.slice(0, 1) }}</span>
</template>
