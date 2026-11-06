<script setup lang="ts">
import GuideEntry from '../components/shared/GuideEntry.vue'
import { useFeaturesStore } from '../stores/features'
import { useTabSwipe } from '../composables/useTabSwipe'
import { taskNavigationLocked } from '../composables/taskNavigationLock'
import { useRoute } from 'vue-router'
import { usePageTab } from '../composables/usePageTab'
import SleepGallery from '../components/plan/SleepGallery.vue'
import BoxPane from '../components/pokemon/BoxPane.vue'
import PokedexPane from '../components/pokemon/PokedexPane.vue'
import Segmented from '../components/shared/Segmented.vue'

const route = useRoute()
const tab = usePageTab(['dex', 'box', 'wall'] as const, 'dex')
const features = useFeaturesStore()
const swipe = useTabSwipe(tab, () => (['dex', 'box', 'wall'] as const).filter(id => features.enabled('pokemon', id)), () => route.query.boxOverview === '1')
</script>

<template>
  <div @touchstart.stop="swipe.touchStart" @touchend.stop="swipe.touchEnd" @touchcancel.stop="swipe.touchCancel" class="stack pokemon-view" :class="{ 'dex-view': tab === 'dex' }">
    <GuideEntry page="pokemon" :show-trigger="false" />
    <Segmented
      guide-id="guide-pokemon-tabs"
      class="pokemon-tabs"
      v-if="!(tab === 'box' && route.query.boxOverview === '1')"
      v-model="tab"
      :inert="taskNavigationLocked"
      :options="[
        { id: 'dex', label: '图鉴' },
        { id: 'box', label: 'Box' },
        { id: 'wall', label: '睡姿图鉴' },
      ]"
    />
    <PokedexPane v-if="tab === 'dex'" />
    <BoxPane v-else-if="tab === 'box'" />
    <SleepGallery v-else-if="tab === 'wall'" />
  </div>
</template>

<style scoped>
.dex-view { flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
.dex-view > .pokemon-tabs { flex-shrink: 0; }
</style>
