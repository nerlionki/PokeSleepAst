<script setup lang="ts">
import { pokeById } from '../../calc/data'
import { pokemonIconUrl } from '../../calc/raeImage'
import { activeSnapshot } from '../../resources/runtime'
import { gameText } from '../../ui/i18n'
import FallbackImage from '../shared/FallbackImage.vue'

defineProps<{ ids: number[] }>()
const meta = activeSnapshot()?.data['meta.json'] as { announcedContent?: { pokemon?: { imageId: number; name: string }[] } } | undefined
const name = (id: number) => gameText(pokeById(id)?.name
  ?? meta?.announcedContent?.pokemon?.find(row => row.imageId === id)?.name ?? `#${id}`)
</script>

<template>
  <div class="encounter-pokemon">
    <FallbackImage v-for="id in ids" :key="id" class="encounter-image" :src="pokemonIconUrl(id)" :alt="name(id)">
      <template #fallback><span class="encounter-image image-fallback" role="img" :aria-label="name(id)">?</span></template>
    </FallbackImage>
  </div>
</template>

<style scoped>
.encounter-pokemon { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
.encounter-image { width: 40px; height: 40px; object-fit: contain; flex: none; }
</style>
