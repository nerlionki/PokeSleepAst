<script setup lang="ts">
import { t as translateUi } from '../ui/i18n'
import GuideEntry from '../components/shared/GuideEntry.vue'
import { useFeaturesStore } from '../stores/features'
import { useTabSwipe } from '../composables/useTabSwipe'
import clientDefaults from '../data/client-defaults.resource'

import { shallowRef } from 'vue'
import { useSettingsStore } from '../stores/settings'
import EnvironmentFields from '../components/shared/EnvironmentFields.vue'
import { usePageTab } from '../composables/usePageTab'
import Segmented from '../components/shared/Segmented.vue'
import ComparePane from '../components/team/ComparePane.vue'
import TeamsPane from '../components/team/TeamsPane.vue'
import ScorePlanPane from '../components/team/ScorePlanPane.vue'
const views_TeamView_config_clientDefaults = clientDefaults.modules.views_TeamView


const settingsStore = useSettingsStore()
const adjusting = shallowRef(views_TeamView_config_clientDefaults["adjustingInitial"])
const tab = usePageTab(['team', 'cmp', 'score'] as const, 'team')
const features = useFeaturesStore()
const swipe = useTabSwipe(tab, () => (['team', 'cmp', 'score'] as const).filter(id => features.enabled('team', id)))
</script>

<template>
  <div @touchstart.stop="swipe.touchStart" @touchend.stop="swipe.touchEnd" @touchcancel.stop="swipe.touchCancel" class="stack">
    <GuideEntry page="team" :show-trigger="false" />
    <button class="btn ghost" type="button" :aria-expanded="adjusting" @click="adjusting = !adjusting">{{ translateUi("配队加成设置") }}</button>
    <section v-if="adjusting" class="card stack"><p class="muted">{{ translateUi("修改立即同步全局设置。") }}</p><EnvironmentFields :value="settingsStore.settings" @change="settingsStore.setEnvironment" /></section>
    <Segmented guide-id="guide-team-tabs" v-model="tab" :options="[{ id: 'team', label: '我的队伍' }, { id: 'cmp', label: '个体对比' }, { id: 'score', label: '冲分规划' }]" />
    <TeamsPane v-if="tab === 'team'" />
    <ComparePane v-else-if="tab === 'cmp'" />
    <ScorePlanPane v-else-if="tab === 'score'" />
  </div>
</template>
