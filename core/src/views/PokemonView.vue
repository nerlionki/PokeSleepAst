<script setup lang="ts">
import { useRoute } from 'vue-router'
import { usePageTab } from '../composables/usePageTab'
import SleepGallery from '../components/plan/SleepGallery.vue'
import BoxPane from '../components/pokemon/BoxPane.vue'
import PokedexPane from '../components/pokemon/PokedexPane.vue'
import Segmented from '../components/shared/Segmented.vue'

const route = useRoute()
const tab = usePageTab(['dex', 'box', 'wall'] as const, 'dex')
</script>

<template>
  <div class="stack">
    <Segmented
      v-if="!(tab === 'box' && route.query.boxOverview === '1')"
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
