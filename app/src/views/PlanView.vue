<script setup lang="ts">
import { usePageTab } from '../composables/usePageTab'
import CandyPane from '../components/plan/CandyPane.vue'
import CatchPane from '../components/plan/CatchPane.vue'
import SleepPane from '../components/plan/SleepPane.vue'
import TrainPane from '../components/plan/TrainPane.vue'
import Segmented from '../components/shared/Segmented.vue'

const tab = usePageTab(['catch', 'sleep', 'candy', 'train'] as const, 'sleep')
</script>

<template>
  <div class="stack">
    <Segmented
      v-model="tab"
      :options="[
        { id: 'catch', label: '捕捉刷糖' },
        { id: 'sleep', label: '睡眠规划' },
        { id: 'candy', label: '糖果增强' },
        { id: 'train', label: '培养规划' },
      ]"
    />
    <CatchPane v-if="tab === 'catch'" />
    <SleepPane v-else-if="tab === 'sleep'" />
    <CandyPane v-else-if="tab === 'candy'" />
    <TrainPane v-else />
  </div>
</template>
