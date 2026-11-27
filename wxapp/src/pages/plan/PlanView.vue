<script setup lang="ts">
import { t as translateUi } from '../../../../core/src/ui/i18n'
import { usePlanPage } from '../../../../core/src/composables/usePlanPage'
import GuideEntry from '../../generated/components/shared/GuideEntry.vue'
import LegacyEncounterPane from '../../generated/components/plan/LegacyEncounterPane.vue'
import CandyPane from '../../generated/components/plan/CandyPane.vue'
import EncounterPane from '../../generated/components/plan/EncounterPane.vue'
import WhistlePane from '../../generated/components/plan/WhistlePane.vue'
import TrainPane from '../../generated/components/plan/TrainPane.vue'
import Segmented from '../../generated/components/shared/Segmented.vue'
import SplitSleepPane from '../../generated/components/plan/SplitSleepPane.vue'
import SpPane from '../../generated/components/plan/SpPane.vue'
import TabContent from '#platform/TabContent.vue'
import SleepPane from './SleepPane.vue'
import WxInput from '../../components/WxInput.vue'
import { useFeaturesStore } from '../../../../core/src/stores/features'
import { useTabSwipe } from '#platform/tabSwipe'
import { isTrialMiniProgram } from '#platform/dataSource'
import PanelProbabilityPane from '../../generated/components/plan/PanelProbabilityPane.vue'
import EventExchangePane from '../../generated/components/plan/EventExchangePane.vue'

const { tab, options, plannerShops, bundles, now, legacy, switchVersion, showUnreleasedToggle, includeUnreleasedPokemon } = usePlanPage(isTrialMiniProgram)
const features = useFeaturesStore()
const swipe = useTabSwipe(tab, () => options.value.filter(option => features.enabled('plan', option.id)).map(option => option.id))
</script>

<template>
  <view @touchstart.stop="swipe.touchStart" @touchend.stop="swipe.touchEnd" @touchcancel.stop="swipe.touchCancel" class="stack fixed-tab-view">
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
          <WxInput v-model="includeUnreleasedPokemon" type="checkbox" role="switch" />
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
  </view>
</template>
