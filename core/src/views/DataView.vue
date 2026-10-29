<script setup lang="ts">
import clientDefaults from '../data/client-defaults.resource'

import { shallowRef } from 'vue'
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
const views_DataView_config_clientDefaults = clientDefaults.modules.views_DataView


const q = shallowRef(views_DataView_config_clientDefaults["qInitial"])
const tab = usePageTab(['island', 'berry', 'ing', 'recipe', 'skill', 'nature', 'pot', 'item', 'flower'] as const, 'island')
</script>

<template>
  <div class="stack">
    <input v-model="q" class="picker-search" placeholder="搜索功能或名称">
    <div class="seg seg-4">
      <button v-if="features.enabled('data', 'island')" type="button" :class="{ on: tab === 'island' }" @click="tab = 'island'">营地</button>
      <button v-if="features.enabled('data', 'berry')" type="button" :class="{ on: tab === 'berry' }" @click="tab = 'berry'">树果</button>
      <button v-if="features.enabled('data', 'ing')" type="button" :class="{ on: tab === 'ing' }" @click="tab = 'ing'">食材</button>
      <button v-if="features.enabled('data', 'recipe')" type="button" :class="{ on: tab === 'recipe' }" @click="tab = 'recipe'">食谱</button>
      <button v-if="features.enabled('data', 'skill')" type="button" :class="{ on: tab === 'skill' }" @click="tab = 'skill'">技能</button>
      <button v-if="features.enabled('data', 'nature')" type="button" :class="{ on: tab === 'nature' }" @click="tab = 'nature'">性格</button>
      <button v-if="features.enabled('data', 'pot')" type="button" :class="{ on: tab === 'pot' }" @click="tab = 'pot'">锅容量</button>
      <button v-if="features.enabled('data', 'item')" type="button" :class="{ on: tab === 'item' }" @click="tab = 'item'">道具</button>
      <button v-if="features.enabled('data', 'flower')" type="button" :class="{ on: tab === 'flower' }" @click="tab = 'flower'">彩庆花</button>
    </div>
    <p v-if="!tab" class="muted">本页功能已隐藏，可在“我的 → 功能开关”重新开启。</p>
    <IslandPane v-if="tab === 'island'" :q="q" />
    <BerryPane v-else-if="tab === 'berry'" :q="q" />
    <IngredientPane v-else-if="tab === 'ing'" :q="q" />
    <RecipePane v-else-if="tab === 'recipe'" :q="q" />
    <SkillPane v-else-if="tab === 'skill'" :q="q" />
    <NaturePane v-else-if="tab === 'nature'" :q="q" />
    <PotPane v-else-if="tab === 'pot'" :q="q" />
    <ItemPane v-else-if="tab === 'item'" :q="q" />
    <FlowerPane v-else-if="tab === 'flower'" />
  </div>
</template>
