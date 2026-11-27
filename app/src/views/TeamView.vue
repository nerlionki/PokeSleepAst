<script setup lang="ts">
import { t as translateUi } from '../../../core/src/ui/i18n'
import GuideEntry from '../../../core/src/components/shared/GuideEntry.vue'
import { useFeaturesStore } from '../../../core/src/stores/features'
import { useTabSwipe } from '#platform/tabSwipe'
import TabContent from '#platform/TabContent.vue'
import Dialog from '#platform/Dialog.vue'
import EnvironmentFields from '../../../core/src/components/shared/EnvironmentFields.vue'
import Segmented from '../../../core/src/components/shared/Segmented.vue'
import ComparePane from '../../../core/src/components/team/ComparePane.vue'
import TeamsPane from '../components/team/TeamsPane.vue'
import MealPlanPane from '../../../core/src/components/team/MealPlanPane.vue'
import { teamTabs, useTeamPage } from '../../../core/src/composables/useTeamPage'

const { tab, adjusting, settingsStore } = useTeamPage()
const features = useFeaturesStore()
const swipe = useTabSwipe(tab, () => teamTabs.filter(option => features.enabled('team', option.id)).map(option => option.id))
</script>

<template>
  <div @touchstart.stop="swipe.touchStart" @touchend.stop="swipe.touchEnd" @touchcancel.stop="swipe.touchCancel" class="stack fixed-tab-view">
    <GuideEntry page="team" :show-trigger="false" />
    <button class="btn ghost" type="button" aria-haspopup="dialog" @click="adjusting = true">{{ translateUi("配队加成设置") }}</button>
    <Dialog v-if="adjusting" :title="translateUi('配队加成设置')" @close="adjusting = false">
      <p class="muted">{{ translateUi("修改立即同步全局设置。") }}</p>
      <EnvironmentFields :value="settingsStore.settings" @change="settingsStore.setEnvironment" />
    </Dialog>
    <Segmented page-tabs guide-id="guide-team-tabs" v-model="tab" :options="teamTabs" />
    <TabContent :reset-on="tab">
      <div class="stack">
        <TeamsPane v-if="tab === 'team'" />
        <ComparePane v-else-if="tab === 'cmp'" />
        <MealPlanPane v-else-if="tab === 'meal'" />
      </div>
    </TabContent>
  </div>
</template>
