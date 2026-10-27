<script setup lang="ts">
import clientDefaults from '../../data/client-defaults.json'

import { computed, shallowRef, watch } from 'vue'
import { pokemonIconUrl, pokemonPortraitUrl, pokemonShinyIconUrl, pokemonShinyPortraitUrl } from '../../calc/raeImage'
const components_shared_PokeSprite_config_clientDefaults = clientDefaults.modules.components_shared_PokeSprite


const props = defineProps<{
  id: number
  name?: string
  large?: boolean
  shiny?: boolean
}>()

const failed = shallowRef(components_shared_PokeSprite_config_clientDefaults["failedInitial"])
const useIcon = shallowRef(components_shared_PokeSprite_config_clientDefaults["useIconInitial"])
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
