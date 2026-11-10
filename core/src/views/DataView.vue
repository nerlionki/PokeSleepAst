<script setup lang="ts">
import { t as translateUi } from '../ui/i18n'
import { resetPageScroll } from '#platform/pageScroll'
import Segmented from '../components/shared/Segmented.vue'
import GuideEntry from '../components/shared/GuideEntry.vue'
import { useTabSwipe } from '../composables/useTabSwipe'
import clientDefaults from '../data/client-defaults.resource'

import { shallowRef, watch } from 'vue'
import { useFeaturesStore } from '../stores/features'
const features = useFeaturesStore()
import { usePageTab } from '../composables/usePageTab'
import BerryPane from '../components/data/BerryPane.vue'
import IngredientPane from '../components/data/IngredientPane.vue'
import IslandPane from '../components/data/IslandPane.vue'
import NaturePane from '../components/data/NaturePane.vue'
import PotPane from '../components/data/PotPane.vue'
import RecipePane from '../components/data/RecipePane.vue'
import SkillPane from '../components/data/SkillPane.vue'
import ItemPane from '../components/data/ItemPane.vue'
import FlowerPane from '../components/data/FlowerPane.vue'
import EventBundlesPane from '../components/data/EventBundlesPane.vue'
import ActivityCalendarPane from '../components/data/ActivityCalendarPane.vue'
const views_DataView_config_clientDefaults = clientDefaults.modules.views_DataView


const options = [
  { id: 'island', label: '营地' },
  { id: 'berry', label: '树果' },
  { id: 'ing', label: '食材' },
  { id: 'recipe', label: '食谱' },
  { id: 'skill', label: '技能' },
  { id: 'nature', label: '性格' },
  { id: 'pot', label: '锅容量' },
  { id: 'item', label: '道具' },
  { id: 'flower', label: '彩庆花' },
  { id: 'bundles', label: '活动\n礼包' },
  { id: 'calendar', label: '活动\n日历' },
] as const
const q = shallowRef(views_DataView_config_clientDefaults["qInitial"])
watch(q, resetPageScroll)
const tabs = options.map(option => option.id)
const tab = usePageTab(tabs, 'island')
const swipe = useTabSwipe(tab, () => tabs.filter(id => features.enabled('data', id)))
</script>

<template>
  <div @touchstart.stop="swipe.touchStart" @touchend.stop="swipe.touchEnd" @touchcancel.stop="swipe.touchCancel" class="stack">
    <GuideEntry page="data" :show-trigger="false" />
    <input v-if="tab !== 'recipe' && tab !== 'calendar'" v-model="q" class="picker-search" :placeholder="translateUi('搜索功能或名称')">
    <Segmented page-tabs guide-id="guide-data-tabs" v-model="tab" class="plan-tabs" :options="options" />
    <IslandPane v-if="tab === 'island'" :q="q" />
    <BerryPane v-else-if="tab === 'berry'" :q="q" />
    <IngredientPane v-else-if="tab === 'ing'" :q="q" />
    <RecipePane v-else-if="tab === 'recipe'" />
    <SkillPane v-else-if="tab === 'skill'" :q="q" />
    <NaturePane v-else-if="tab === 'nature'" :q="q" />
    <PotPane v-else-if="tab === 'pot'" :q="q" />
    <ItemPane v-else-if="tab === 'item'" :q="q" />
    <FlowerPane v-else-if="tab === 'flower'" />
    <EventBundlesPane v-else-if="tab === 'bundles'" :q="q" />
    <ActivityCalendarPane v-else-if="tab === 'calendar'" />
  </div>
</template>
