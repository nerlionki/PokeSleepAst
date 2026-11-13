<script setup lang="ts">
import { t as translateUi } from '../ui/i18n'
import GuideEntry from '../components/shared/GuideEntry.vue'
import { useFeaturesStore } from '../stores/features'
import { useTabSwipe } from '../composables/useTabSwipe'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import LegacyEncounterPane from '../components/plan/LegacyEncounterPane.vue'
import { usePageTab } from '../composables/usePageTab'
import CandyPane from '../components/plan/CandyPane.vue'
import EncounterPane from '../components/plan/EncounterPane.vue'
import SleepPane from '../components/plan/SleepPane.vue'
import WhistlePane from '../components/plan/WhistlePane.vue'
import TrainPane from '../components/plan/TrainPane.vue'
import SplitSleepPane from '../components/plan/SplitSleepPane.vue'
import Segmented from '../components/shared/Segmented.vue'
import SpPane from '../components/plan/SpPane.vue'
import { provideEncounterAvailability } from '../composables/useEncounterAvailability'
import TabContent from '#platform/TabContent.vue'

const tab = usePageTab(['encounter', 'sleep', 'split', 'candy', 'train', 'whistle', 'sp'] as const, 'sleep')
const { visible: showUnreleasedToggle, includeUnreleasedPokemon } = provideEncounterAvailability(computed(() => tab.value === 'encounter'))
const route = useRoute()
const router = useRouter()
const legacy = computed(() => route.query.encounterVersion === 'legacy' || ['catch', 'baby', 'completion'].includes(String(route.query.tab)))
function switchVersion() {
  const { legacyTab, encounterVersion, ...query } = route.query
  void router.push({ path: route.path, query: { ...query, tab: 'encounter', ...(!legacy.value ? { encounterVersion: 'legacy', legacyTab: legacyTab ?? 'catch' } : {}) } })
}
const features = useFeaturesStore()
const swipe = useTabSwipe(tab, () => (['encounter', 'sleep', 'split', 'candy', 'train', 'whistle', 'sp'] as const).filter(id => features.enabled('plan', id)))
</script>

<template>
  <div @touchstart.stop="swipe.touchStart" @touchend.stop="swipe.touchEnd" @touchcancel.stop="swipe.touchCancel" class="stack fixed-tab-view">
    <GuideEntry page="plan" :show-trigger="false" />
    <Segmented
      page-tabs
      guide-id="guide-plan-tabs"
      v-model="tab"
      class="plan-tabs"
      :options="[
        { id: 'encounter', label: '遇见规划' },
        { id: 'sleep', label: '睡眠规划' },
        { id: 'split', label: '目标拆觉' },
        { id: 'candy', label: '糖果增强' },
        { id: 'train', label: '培养规划' },
        { id: 'whistle', label: '吹哨规划' },
        { id: 'sp', label: 'SP 计算' },
      ]"
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
    </TabContent>
  </div>
</template>
