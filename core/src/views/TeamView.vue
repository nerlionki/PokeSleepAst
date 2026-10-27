<script setup lang="ts">
import clientDefaults from '../data/client-defaults.json'

import { shallowRef } from 'vue'
import { useSettingsStore } from '../stores/settings'
import EnvironmentFields from '../components/shared/EnvironmentFields.vue'
import { usePageTab } from '../composables/usePageTab'
import Segmented from '../components/shared/Segmented.vue'
import ComparePane from '../components/team/ComparePane.vue'
import TeamRosterPane from '../components/team/TeamRosterPane.vue'
import ScorePlanPane from '../components/team/ScorePlanPane.vue'
const views_TeamView_config_clientDefaults = clientDefaults.modules.views_TeamView


const settingsStore = useSettingsStore()
const adjusting = shallowRef(views_TeamView_config_clientDefaults["adjustingInitial"])
const tab = usePageTab(['team', 'cmp', 'score'] as const, 'team')
</script>

<template>
  <div class="stack">
    <button class="btn ghost" type="button" :aria-expanded="adjusting" @click="adjusting = !adjusting">配队加成设置</button>
    <section v-if="adjusting" class="card stack"><p class="muted">修改立即同步全局设置。</p><EnvironmentFields :value="settingsStore.settings" @change="settingsStore.setEnvironment" /></section>
    <Segmented v-model="tab" :options="[{ id: 'team', label: '当前队伍' }, { id: 'cmp', label: '个体对比' }, { id: 'score', label: '冲分规划' }]" />
    <TeamRosterPane v-if="tab === 'team'" />
    <ComparePane v-else-if="tab === 'cmp'" />
    <ScorePlanPane v-else />
  </div>
</template>
