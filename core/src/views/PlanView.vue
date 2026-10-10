<script setup lang="ts">
import { usePageTab } from '../composables/usePageTab'
import CandyPane from '../components/plan/CandyPane.vue'
import BabyEfficiencyPane from '../components/plan/BabyEfficiencyPane.vue'
import CatchPane from '../components/plan/CatchPane.vue'
import SleepPane from '../components/plan/SleepPane.vue'
import WhistlePane from '../components/plan/WhistlePane.vue'
import TrainPane from '../components/plan/TrainPane.vue'
import Segmented from '../components/shared/Segmented.vue'

const tab = usePageTab(['catch', 'sleep', 'baby', 'candy', 'train', 'whistle'] as const, 'sleep')
</script>

<template>
  <div class="stack">
    <Segmented
      v-model="tab"
      :options="[
        { id: 'catch', label: '捕捉刷糖' },
        { id: 'sleep', label: '睡眠规划' },
        { id: 'baby', label: '宝宝效率' },
        { id: 'candy', label: '糖果增强' },
        { id: 'train', label: '培养规划' },
        { id: 'whistle', label: '吹哨规划' },
      ]"
    />
    <CatchPane v-if="tab === 'catch'" />
    <SleepPane v-else-if="tab === 'sleep'" />
    <BabyEfficiencyPane v-else-if="tab === 'baby'" />
    <CandyPane v-else-if="tab === 'candy'" />
    <WhistlePane v-else-if="tab === 'whistle'" />
    <TrainPane v-else />
  </div>
</template>
