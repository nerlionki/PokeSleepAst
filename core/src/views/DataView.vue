<script setup lang="ts">
import { shallowRef } from 'vue'
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

const q = shallowRef('')
const tab = usePageTab(['island', 'berry', 'ing', 'recipe', 'skill', 'nature', 'pot', 'item', 'flower'] as const, 'island')
</script>

<template>
  <div class="stack">
    <input v-model="q" class="picker-search" placeholder="搜索功能或名称">
    <div class="seg">
      <button type="button" :class="{ on: tab === 'island' }" @click="tab = 'island'">营地</button>
      <button type="button" :class="{ on: tab === 'berry' }" @click="tab = 'berry'">树果</button>
      <button type="button" :class="{ on: tab === 'ing' }" @click="tab = 'ing'">食材</button>
      <button type="button" :class="{ on: tab === 'recipe' }" @click="tab = 'recipe'">食谱</button>
      <button type="button" :class="{ on: tab === 'skill' }" @click="tab = 'skill'">技能</button>
      <button type="button" :class="{ on: tab === 'nature' }" @click="tab = 'nature'">性格</button>
      <button type="button" :class="{ on: tab === 'pot' }" @click="tab = 'pot'">开锅</button>
      <button type="button" :class="{ on: tab === 'item' }" @click="tab = 'item'">道具</button>
      <button type="button" :class="{ on: tab === 'flower' }" @click="tab = 'flower'">彩庆花</button>
    </div>
    <IslandPane v-if="tab === 'island'" :q="q" />
    <BerryPane v-else-if="tab === 'berry'" :q="q" />
    <IngredientPane v-else-if="tab === 'ing'" :q="q" />
    <RecipePane v-else-if="tab === 'recipe'" :q="q" />
    <SkillPane v-else-if="tab === 'skill'" :q="q" />
    <NaturePane v-else-if="tab === 'nature'" :q="q" />
    <PotPane v-else-if="tab === 'pot'" :q="q" />
    <ItemPane v-else-if="tab === 'item'" :q="q" />
    <FlowerPane v-else />
  </div>
</template>
