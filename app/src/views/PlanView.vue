<script setup lang="ts">
import { t as translateUi } from '../../../core/src/ui/i18n'
import { usePlanPage } from '../../../core/src/composables/usePlanPage'
import GuideEntry from '../../../core/src/components/shared/GuideEntry.vue'
import LegacyEncounterPane from '../../../core/src/components/plan/LegacyEncounterPane.vue'
import CandyPane from '../../../core/src/components/plan/CandyPane.vue'
import EncounterPane from '../../../core/src/components/plan/EncounterPane.vue'
import WhistlePane from '../../../core/src/components/plan/WhistlePane.vue'
import TrainPane from '../../../core/src/components/plan/TrainPane.vue'
import Segmented from '../../../core/src/components/shared/Segmented.vue'
import SplitSleepPane from '../../../core/src/components/plan/SplitSleepPane.vue'
import SpPane from '../../../core/src/components/plan/SpPane.vue'
import TabContent from '#platform/TabContent.vue'
import SleepPane from '../components/plan/SleepPane.vue'
import { useFeaturesStore } from '../../../core/src/stores/features'
import { useTabSwipe } from '#platform/tabSwipe'
import { isTrialMiniProgram } from '#platform/dataSource'
import PanelProbabilityPane from '../../../core/src/components/plan/PanelProbabilityPane.vue'
import EventExchangePane from '../../../core/src/components/plan/EventExchangePane.vue'

const { tab, options, plannerShops, bundles, now, legacy, switchVersion, showUnreleasedToggle, includeUnreleasedPokemon } = usePlanPage(isTrialMiniProgram)
const features = useFeaturesStore()
const swipe = useTabSwipe(tab, () => options.value.filter(option => features.enabled('plan', option.id)).map(option => option.id))
</script>

<template>
  <div @touchstart.stop="swipe.touchStart" @touchend.stop="swipe.touchEnd" @touchcancel.stop="swipe.touchCancel" class="stack fixed-tab-view">
    <GuideEntry page="plan" :show-trigger="false" />
    <Segmented
      page-tabs
      guide-id="guide-plan-tabs"
      v-model="tab"
      class="plan-tabs"
      :options="options"
    />
    <CandyPane v-if="tab === 'candy'" />
    <TabContent v-else :reset-on="legacy ? tab + ':legacy' : tab">
      <section v-if="tab === 'encounter'" class="stack">
        <button class="btn ghost" type="button" @click="switchVersion">{{ legacy ? translateUi("切换至新版") : translateUi("切换至旧版") }}</button>
        <label v-if="showUnreleasedToggle" class="row">
          <input v-model="includeUnreleasedPokemon" type="checkbox" role="switch">
          {{ translateUi('未发布宝可梦是否加入抽选') }}
        </label>
        <LegacyEncounterPane v-if="legacy" />
        <EncounterPane v-else />
      </section>
      <SleepPane v-else-if="tab === 'sleep'" />
      <SplitSleepPane v-else-if="tab === 'split'" />
      <WhistlePane v-else-if="tab === 'whistle'" />
      <TrainPane v-else-if="tab === 'train'" />
      <SpPane v-else-if="tab === 'sp'" />
      <PanelProbabilityPane v-else-if="tab === 'panel'" />
      <EventExchangePane v-else-if="tab === 'exchange'" :shops="plannerShops" :now="now" :catalog="bundles" />
    </TabContent>
  </div>
</template>
