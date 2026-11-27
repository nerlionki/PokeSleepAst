<script setup lang="ts">
import { t as translateUi } from '../../../../core/src/ui/i18n'
import GuideEntry from '../../generated/components/shared/GuideEntry.vue'
import { useFeaturesStore } from '../../../../core/src/stores/features'
import { useTabSwipe } from '#platform/tabSwipe'
import TabContent from '#platform/TabContent.vue'
import Dialog from '#platform/Dialog.vue'
import EnvironmentFields from '../../generated/components/shared/EnvironmentFields.vue'
import Segmented from '../../generated/components/shared/Segmented.vue'
import ComparePane from '../../generated/components/team/ComparePane.vue'
import TeamsPane from './TeamsPane.vue'
import MealPlanPane from '../../generated/components/team/MealPlanPane.vue'
import { teamTabs, useTeamPage } from '../../../../core/src/composables/useTeamPage'

const { tab, adjusting, settingsStore } = useTeamPage()
const features = useFeaturesStore()
const swipe = useTabSwipe(tab, () => teamTabs.filter(option => features.enabled('team', option.id)).map(option => option.id))
</script>

<template>
  <view @touchstart.stop="swipe.touchStart" @touchend.stop="swipe.touchEnd" @touchcancel.stop="swipe.touchCancel" class="stack fixed-tab-view">
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
  </view>
</template>
