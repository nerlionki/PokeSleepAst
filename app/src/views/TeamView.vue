<script setup lang="ts">
import { usePageTab } from '../composables/usePageTab'
import Segmented from '../components/shared/Segmented.vue'
import ComparePane from '../components/team/ComparePane.vue'
import TeamRosterPane from '../components/team/TeamRosterPane.vue'

const tab = usePageTab(['team', 'cmp'] as const, 'team')
</script>

<template>
  <div class="stack">
    <Segmented v-model="tab" :options="[{ id: 'team', label: '当前队伍' }, { id: 'cmp', label: '个体对比' }]" />
    <TeamRosterPane v-if="tab === 'team'" />
    <ComparePane v-else />
  </div>
</template>
