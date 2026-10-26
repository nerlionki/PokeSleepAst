<script setup lang="ts">
import { usePageTab } from '../composables/usePageTab'
import CandyPane from '../components/plan/CandyPane.vue'
import BabyEfficiencyPane from '../components/plan/BabyEfficiencyPane.vue'
import CompletionEfficiencyPane from '../components/plan/CompletionEfficiencyPane.vue'
import CatchPane from '../components/plan/CatchPane.vue'
import SleepPane from '../components/plan/SleepPane.vue'
import WhistlePane from '../components/plan/WhistlePane.vue'
import TrainPane from '../components/plan/TrainPane.vue'
import SplitSleepPane from '../components/plan/SplitSleepPane.vue'
import Segmented from '../components/shared/Segmented.vue'

const tab = usePageTab(['catch', 'sleep', 'split', 'baby', 'completion', 'candy', 'train', 'whistle'] as const, 'sleep')
</script>

<template>
  <div class="stack">
    <Segmented
      v-model="tab"
      :options="[
        { id: 'catch', label: '捕捉刷糖' },
        { id: 'sleep', label: '睡眠规划' },
        { id: 'split', label: '目标拆觉' },
        { id: 'baby', label: '宝宝效率' },
        { id: 'completion', label: '补齐效率' },
        { id: 'candy', label: '糖果增强' },
        { id: 'train', label: '培养规划' },
        { id: 'whistle', label: '吹哨规划' },
      ]"
    />
    <CatchPane v-if="tab === 'catch'" />
    <SleepPane v-else-if="tab === 'sleep'" />
    <SplitSleepPane v-else-if="tab === 'split'" />
    <BabyEfficiencyPane v-else-if="tab === 'baby'" />
    <CompletionEfficiencyPane v-else-if="tab === 'completion'" />
    <CandyPane v-else-if="tab === 'candy'" />
    <WhistlePane v-else-if="tab === 'whistle'" />
    <TrainPane v-else />
  </div>
</template>
