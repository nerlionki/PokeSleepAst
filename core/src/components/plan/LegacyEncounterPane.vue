<script setup lang="ts">
import { useTabSwipe } from '../../composables/useTabSwipe'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useFeaturesStore } from '../../stores/features'
import Segmented from '../shared/Segmented.vue'
import CatchPane from './CatchPane.vue'
import BabyEfficiencyPane from './BabyEfficiencyPane.vue'
import CompletionEfficiencyPane from './CompletionEfficiencyPane.vue'

const route = useRoute()
const router = useRouter()
const features = useFeaturesStore()
const options = [
  { id: 'catch', label: '捕捉刷糖' },
  { id: 'baby', label: '宝宝效率' },
  { id: 'completion', label: '补齐效率' },
]
const tab = computed({
  get: () => {
    const available = options.filter(option => features.enabled('plan', option.id))
    const requested = route.query.legacyTab ?? route.query.tab
    return available.find(option => option.id === requested)?.id ?? available[0]?.id ?? ''
  },
  set: value => { void router.push({ path: route.path, query: { ...route.query, tab: 'encounter', encounterVersion: 'legacy', legacyTab: value } }) },
})
const swipe = useTabSwipe(tab, () => options.filter(option => features.enabled('plan', option.id)).map(option => option.id))
</script>

<template>
  <div @touchstart.stop="swipe.touchStart" @touchend.stop="swipe.touchEnd" @touchcancel.stop="swipe.touchCancel" class="stack">
    <Segmented v-model="tab" :options="options" />
    <CatchPane v-if="tab === 'catch'" />
    <BabyEfficiencyPane v-else-if="tab === 'baby'" />
    <CompletionEfficiencyPane v-else-if="tab === 'completion'" />
  </div>
</template>
