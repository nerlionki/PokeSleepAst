<script setup lang="ts">
import { usePageTab } from '../composables/usePageTab'
import SleepGallery from '../components/plan/SleepGallery.vue'
import BoxPane from '../components/pokemon/BoxPane.vue'
import PokedexPane from '../components/pokemon/PokedexPane.vue'
import Segmented from '../components/shared/Segmented.vue'

const tab = usePageTab(['dex', 'box', 'wall'] as const, 'dex')
</script>

<template>
  <div class="stack">
    <Segmented
      v-model="tab"
      :options="[
        { id: 'dex', label: '图鉴' },
        { id: 'box', label: 'Box' },
        { id: 'wall', label: '睡姿图鉴' },
      ]"
    />
    <PokedexPane v-if="tab === 'dex'" />
    <BoxPane v-else-if="tab === 'box'" />
    <SleepGallery v-else />
  </div>
</template>
