<script setup lang="ts">
import GuideEntry from '../../../core/src/components/shared/GuideEntry.vue'
import { useFeaturesStore } from '../../../core/src/stores/features'
import { useTabSwipe } from '#platform/tabSwipe'
import { taskNavigationLocked } from '../../../core/src/composables/taskNavigationLock'
import { useRoute } from 'vue-router'
import SleepGallery from '../../../core/src/components/plan/SleepGallery.vue'
import BoxPane from '../components/pokemon/BoxPane.vue'
import PokedexPane from '../../../core/src/components/pokemon/PokedexPane.vue'
import Segmented from '../../../core/src/components/shared/Segmented.vue'
import { pokemonTabs, usePokemonPage } from '../../../core/src/composables/usePokemonPage'

const route = useRoute()
const tab = usePokemonPage()
const features = useFeaturesStore()
const swipe = useTabSwipe(tab, () => pokemonTabs.filter(option => features.enabled('pokemon', option.id)).map(option => option.id), () => route.query.boxOverview === '1')
</script>

<template>
  <div @touchstart.stop="swipe.touchStart" @touchend.stop="swipe.touchEnd" @touchcancel.stop="swipe.touchCancel" class="stack pokemon-view" :class="{ 'dex-view': tab === 'dex' }">
    <GuideEntry page="pokemon" :show-trigger="false" />
    <Segmented
      page-tabs
      guide-id="guide-pokemon-tabs"
      class="pokemon-tabs"
      v-if="!(tab === 'box' && route.query.boxOverview === '1')"
      v-model="tab"
      :inert="taskNavigationLocked"
      :options="pokemonTabs"
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
