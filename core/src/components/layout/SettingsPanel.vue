<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { BERRIES, ISLANDS, RECIPES } from '../../calc/data'
import { canPickBerries } from '../../calc/defaults'
import { categoryLabel, recipeLevelOf } from '../../calc/cook'
import BerryIcon from '../shared/BerryIcon.vue'
import MealIcon from '../shared/MealIcon.vue'
import UpdateSettings from '../update/UpdateSettings.vue'
import { useSettingsStore } from '../../stores/settings'
import type { MealCategory } from '../../types'

const emit = defineEmits<{ close: [] }>()
const store = useSettingsStore()
const { settings, summary } = storeToRefs(store)

const pickBerries = computed(() => canPickBerries(settings.value.island))
const islandBerries = computed(() => ISLANDS.find((i) => i.id === settings.value.island)?.berries ?? [])

function toggleBerry(name: string) {
  const cur = settings.value.berries
  if (cur.includes(name)) {
    settings.value.berries = cur.filter((b) => b !== name)
    return
  }
  if (cur.length >= 3) return
  settings.value.berries = [...cur, name]
}

const recipeGroups = computed(() => (['curry', 'salad', 'dessert'] as MealCategory[]).map((c) => ({
  id: c,
  label: categoryLabel(c),
  recipes: RECIPES.filter((r) => r.category === c && !r.mix),
})))

function setRecipeLevel(name: string, level: number) {
  settings.value.recipeLevels = {
    ...settings.value.recipeLevels,
    [name]: Math.min(60, Math.max(1, Number(level) || 1)),
  }
}
</script>

<template>
  <div v-back="() => emit('close')" class="overlay" @click.self="emit('close')">
    <section class="sheet stack">
      <div class="row">
        <h2>全局设置</h2>
        <button class="btn ghost" type="button" @click="emit('close')">关闭</button>
      </div>
      <p class="muted">{{ summary }}</p>
      <UpdateSettings />
      <div class="row">
        <button class="btn ghost" type="button" @click="store.applyPreset('default')">默认作息</button>
        <button class="btn ghost" type="button" @click="store.applyPreset('ideal')">理想满睡</button>
      </div>
      <div class="row">
        <button class="btn ghost" type="button" @click="store.applyPreset('work18')">18h 工作</button>
        <button class="btn ghost" type="button" @click="store.applyPreset('helpMax')">帮手 MAX</button>
      </div>
      <div class="field">
        <label>当前岛屿</label>
        <select :value="settings.island" @change="store.applyIsland(($event.target as HTMLSelectElement).value as typeof settings.island)">
          <option v-for="i in ISLANDS" :key="i.id" :value="i.id">{{ i.name }}</option>
        </select>
      </div>
      <div v-if="pickBerries" class="stack">
        <p class="muted">树果喜好 {{ settings.berries.length }}/3 · 仅 1 岛 / EX / EX2 可改</p>
        <div class="picker-opts">
          <button
            v-for="b in BERRIES"
            :key="b.name"
            type="button"
            :class="{ on: settings.berries.includes(b.name) }"
            @click="toggleBerry(b.name)"
          >
            <BerryIcon :name="b.name" />{{ b.name }}
          </button>
        </div>
      </div>
      <p v-else class="muted berry-inline">
        本岛固定喜好：
        <template v-if="islandBerries.length">
          <span v-for="name in islandBerries" :key="name" class="berry-name"><BerryIcon :name="name" small />{{ name }}</span>
        </template>
        <template v-else>无</template>
      </p>
      <div class="field">
        <label>营地加成 {{ Math.round(settings.areaBonus * 100) }}%</label>
        <input v-model.number="settings.areaBonus" type="range" min="0" max="0.85" step="0.01">
      </div>
      <div class="row">
        <div class="field">
          <label>就寝</label>
          <input v-model="settings.sleepStart" type="time">
        </div>
        <div class="field">
          <label>起床</label>
          <input v-model="settings.sleepEnd" type="time">
        </div>
      </div>
      <div class="field">
        <label>睡眠分数</label>
        <input v-model.number="settings.sleepScore" type="number" min="0" max="100">
      </div>
      <label class="row"><input v-model="settings.meals" type="checkbox"> 三餐回活力</label>
      <label class="row"><input v-model="settings.incense" type="checkbox"> 回复薰香（恢复 ×2）</label>
      <label class="row"><input v-model="settings.goodCamp" type="checkbox"> 优质露营券</label>
      <label class="row"><input v-model="settings.sundayPot" type="checkbox"> 周日锅 ×2（日产手动开）</label>
      <label class="row"><input v-model="settings.shinyUp" type="checkbox"> 全局闪光 UP</label>
      <div class="field">
        <label>日均技能回活力（近似，时序仍会仿真发动）</label>
        <input v-model.number="settings.dailySkillHeal" type="number" min="0">
      </div>
      <div class="field">
        <label>哨子额外帮忙</label>
        <input v-model.number="settings.whistleHelps" type="number" min="0" max="20">
      </div>
      <div class="field">
        <label>帮手奖励次数（个体对比；MAX=5）</label>
        <input v-model.number="settings.helpingBonus" type="number" min="0" max="5">
      </div>
      <div class="field">
        <label>本周喜好料理</label>
        <select v-model="settings.mealCategory">
          <option value="curry">咖哩濃湯</option>
          <option value="salad">沙拉</option>
          <option value="dessert">点心饮料</option>
        </select>
      </div>
      <div class="stack">
        <p>食谱等级</p>
        <p class="muted">每个食谱单独填写，未填按 1 级。</p>
        <details v-for="g in recipeGroups" :key="g.id" class="recipe-levels">
          <summary>{{ g.label }} · {{ g.recipes.length }} 道</summary>
          <div v-for="r in g.recipes" :key="r.name" class="recipe-lv-row">
            <MealIcon :name="r.name" />
            <span>{{ r.name }}</span>
            <input
              :value="recipeLevelOf(settings, r.name)"
              type="number"
              min="1"
              max="60"
              @change="setRecipeLevel(r.name, Number(($event.target as HTMLInputElement).value))"
            >
          </div>
        </details>
      </div>
      <div class="field">
        <label>锅容量</label>
        <input v-model.number="settings.potSize" type="number" min="21" max="81">
      </div>
      <div class="field">
        <label>活动倍率</label>
        <select v-model.number="settings.eventMult">
          <option :value="1">平时 1</option>
          <option :value="1.1">1.1</option>
          <option :value="1.3">1.3</option>
          <option :value="1.5">好眠 1.5</option>
          <option :value="2">满月 2</option>
          <option :value="2.5">满月 2.5</option>
          <option :value="3">满月 3</option>
          <option :value="4">满月 4</option>
        </select>
      </div>
      <div class="field">
        <label>分析周期</label>
        <select v-model="settings.period">
          <option value="day">日产</option>
          <option value="week">周产</option>
        </select>
      </div>
      <button class="btn ghost" type="button" @click="store.reset()">恢复默认</button>
    </section>
  </div>
</template>
