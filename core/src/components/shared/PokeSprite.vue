<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { pokemonIconUrl, pokemonPortraitUrl, pokemonShinyIconUrl, pokemonShinyPortraitUrl } from '../../calc/raeImage'

const props = defineProps<{
  id: number
  name?: string
  large?: boolean
  shiny?: boolean
}>()

const failed = shallowRef(false)
const useIcon = shallowRef(false)
const hue = computed(() => (props.id * 47) % 360)
const src = computed(() => {
  if (props.large && !useIcon.value) return (props.shiny && pokemonShinyPortraitUrl(props.id)) || pokemonPortraitUrl(props.id)
  return (props.shiny && pokemonShinyIconUrl(props.id)) || pokemonIconUrl(props.id)
})

watch(() => [props.id, props.shiny], () => {
  failed.value = false
  useIcon.value = false
})

function onError() {
  if (props.large && !useIcon.value) {
    useIcon.value = true
    return
  }
  failed.value = true
}
</script>

<template>
  <img
    v-if="!failed"
    class="sprite"
    :class="{ lg: large }"
    :src="src"
    :alt="name ?? String(id)"
    @error="onError"
  >
  <div
    v-else
    class="fallback-sprite"
    :style="{ background: `hsl(${hue} 40% 28%)` }"
  >
    #{{ id }}
  </div>
</template>
