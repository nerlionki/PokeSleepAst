<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { pokeById } from '../../calc/data'
import { pokemonIconUrl, pokemonPortraitUrl, pokemonShinyIconUrl, pokemonShinyPortraitUrl } from '../../calc/raeImage'
const props = defineProps<{ id: number; name?: string; large?: boolean; shiny?: boolean }>()
const failed = shallowRef(false)
const useIcon = shallowRef(false)
const shinyFailed = shallowRef(false)
const label = computed(() => props.name || pokeById(props.id)?.name || '#' + props.id)
const shinySrc = computed(() => props.large && !useIcon.value ? pokemonShinyPortraitUrl(props.id) : pokemonShinyIconUrl(props.id))
const showShinyMark = computed(() => props.shiny && (shinyFailed.value || !shinySrc.value))
const src = computed(() => {
  if (props.shiny && !showShinyMark.value) return shinySrc.value
  return props.large && !useIcon.value ? pokemonPortraitUrl(props.id) : pokemonIconUrl(props.id)
})
watch(() => [props.id, props.shiny, props.large], () => { failed.value = false; useIcon.value = false; shinyFailed.value = false })
function onError() {
  if (props.shiny && !showShinyMark.value) { shinyFailed.value = true; return }
  if (props.large && !useIcon.value) { useIcon.value = true; return }
  failed.value = true
}
</script>
<template>
  <div class="sprite sprite-frame" :class="{ lg: large }">
    <img v-if="src && !failed" class="sprite-image" loading="lazy" decoding="async" :src="src" :alt="label" @error="onError">
    <span v-else class="sprite-label">{{ label }}</span>
    <span v-if="showShinyMark" class="sprite-shiny" aria-label="闪光">闪</span>
  </div>
</template>
<style scoped>
.sprite-frame { position: relative; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
.sprite-image { width: 100%; height: 100%; object-fit: contain; }
.sprite-label { font-size: 12px; text-align: center; overflow-wrap: anywhere; }
.sprite-shiny { position: absolute; top: 0; right: 0; font-size: 11px; line-height: 16px; padding: 0 3px; border-radius: 4px; color: var(--ink); background: var(--sage); }
</style>
