<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import Segmented from '../components/shared/Segmented.vue'
import ComparePane from '../components/team/ComparePane.vue'
import TeamRosterPane from '../components/team/TeamRosterPane.vue'

const route = useRoute()
const tab = ref<'team' | 'cmp'>(route.query.tab === 'cmp' ? 'cmp' : 'team')

watch(() => route.query.tab, (v) => {
  if (v === 'cmp' || v === 'team') tab.value = v
})
</script>

<template>
  <div class="stack">
    <Segmented v-model="tab" :options="[{ id: 'team', label: '当前队伍' }, { id: 'cmp', label: '个体对比' }]" />
    <TeamRosterPane v-if="tab === 'team'" />
    <ComparePane v-else />
  </div>
</template>
