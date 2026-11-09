<script setup lang="ts">
import TimeField from '../shared/TimeField.vue'
import { t as translateUi, gameText } from '../../ui/i18n'
import { INPUT_RANGES } from '../../calc/inputRanges'
const INPUT_LIMITS = INPUT_RANGES.SettingsPanel

import { AREA_BONUS_MAX, AREA_BONUS_MAX_PERCENT } from '../../calc/areaBonus'
import ActivitySettings from '../shared/ActivitySettings.vue'
import { useActivities } from '../../composables/useActivities'
import { EVENT_BONUSES } from '../../calc/sleep'
import FormField from '../shared/FormField.vue'
import { MIX_OPTIONS } from '../../calc/sleepRules'
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { POT_TIERS, RECIPES } from '../../calc/data'
import { categoryLabel, RECIPE_LEVEL_MAX, recipeLevelOf } from '../../calc/cook'
import { compareRecipeEnergyDescending } from '../../calc/recipes'
import EnvironmentFields from '../shared/EnvironmentFields.vue'
import MealIcon from '../shared/MealIcon.vue'
import { useSettingsStore } from '../../stores/settings'
import type { MealCategory } from '../../types'

const props = defineProps<{ embedded?: boolean }>()
const emit = defineEmits<{ close: [] }>()
const store = useSettingsStore()
const { settings, summary } = storeToRefs(store)
const activity = useActivities(settings, () => settings.value.island)
const eventMult = activity.field('drowsyPowerMultiplier', () => settings.value.eventMult)
const shinyUp = activity.field('shinyUp', () => settings.value.shinyUp)
const mixMode = activity.field('eventMix', () => settings.value.sleepEventMix)
const maxPotSize = Math.max(...POT_TIERS.map(tier => tier.pot))
const minPotSize = Math.min(...POT_TIERS.map(tier => tier.pot))

const recipeGroups = computed(() => (['curry', 'salad', 'dessert'] as MealCategory[]).map((c) => ({
  id: c,
  label: categoryLabel(c),
  recipes: RECIPES.filter((r) => r.category === c && !r.mix)
    .sort((a, b) => compareRecipeEnergyDescending(a, b)),
})))

function setRecipeLevel(name: string, level: number) {
  settings.value.recipeLevels = {
    ...settings.value.recipeLevels,
    [name]: Math.min(RECIPE_LEVEL_MAX, Math.max(1, Number(level) || 1)),
  }
}
</script>

<template>
  <div v-back="props.embedded ? undefined : () => emit('close')" :class="props.embedded ? 'stack' : 'overlay'" @click.self="!props.embedded && emit('close')">
    <section :class="props.embedded ? 'card stack' : 'sheet stack'">
      <div v-if="!props.embedded" class="row">
        <h2>{{ translateUi("全局设置") }}</h2>
        <button class="btn ghost" type="button" @click="emit('close')">{{ translateUi("关闭") }}</button>
      </div>
      <p class="muted">{{ summary }}</p>
      <div class="row">
        <button class="btn ghost" type="button" @click="store.applyPreset('default')">{{ translateUi("默认作息") }}</button>
        <button class="btn ghost" type="button" @click="store.applyPreset('ideal')">{{ translateUi("理想满睡") }}</button>
      </div>
      <div class="row">
        <button class="btn ghost" type="button" @click="store.applyPreset('work18')">{{ translateUi("18h 工作") }}</button>
        <button class="btn ghost" type="button" @click="store.applyPreset('helpMax')">{{ translateUi("帮手 MAX") }}</button>
      </div>
      <EnvironmentFields :value="settings" @change="store.setEnvironment" />
      <FormField v-slot="{ id }" data-swipe-ignore @touchstart.stop @touchend.stop @touchcancel.stop :label="translateUi('营地加成 {arg1}%（上限 {arg2}%）', { arg1: String(Math.round(settings.areaBonus * 100)), arg2: String(AREA_BONUS_MAX_PERCENT) })"><input :id="id" v-model.number="settings.areaBonus" type="range" :min="INPUT_LIMITS.settings_areaBonus.min" :max="AREA_BONUS_MAX" :step="INPUT_LIMITS.settings_areaBonus.step"></FormField>
      <div class="row">
        <FormField v-slot="{ id }" :label="translateUi('就寝')"><TimeField :id="id" v-model="settings.sleepStart" /></FormField>
        <FormField v-slot="{ id }" :label="translateUi('起床')"><TimeField :id="id" v-model="settings.sleepEnd" /></FormField>
      </div>
      <FormField v-slot="{ id }" :label="translateUi('睡眠分数')"><input :id="id" v-model.number="settings.sleepScore" type="number" :min="INPUT_LIMITS.settings_sleepScore.min" :max="INPUT_LIMITS.settings_sleepScore.max"></FormField>
      <label class="row"><input v-model="settings.meals" type="checkbox"> {{ translateUi("三餐回活力") }}</label>
      <label class="row"><input v-model="settings.incense" type="checkbox"> {{ translateUi("回复薰香（恢复 ×2）") }}</label>
      <label class="row"><input v-model="settings.goodCamp" type="checkbox"> {{ translateUi("优质露营券") }}</label>
      <label class="row"><input v-model="settings.sundayPot" type="checkbox"> {{ translateUi("周日锅 ×2（日产手动开）") }}</label>
      <label class="row"><input v-model="shinyUp" type="checkbox"> {{ translateUi("全局闪光 UP") }}</label>
      <FormField v-slot="{ id }" :label="translateUi('日均技能回活力（近似，时序仍会仿真发动）')"><input :id="id" v-model.number="settings.dailySkillHeal" type="number" :min="INPUT_LIMITS.settings_dailySkillHeal.min"></FormField>
      <FormField v-slot="{ id }" :label="translateUi('哨子额外帮忙')"><input :id="id" v-model.number="settings.whistleHelps" type="number" :min="INPUT_LIMITS.settings_whistleHelps.min" :max="INPUT_LIMITS.settings_whistleHelps.max"></FormField>
      <FormField v-slot="{ id }" :label="translateUi('本周喜好料理')"><select :id="id" v-model="settings.mealCategory">
          <option value="curry">{{ translateUi("咖喱、浓汤") }}</option>
          <option value="salad">{{ translateUi("沙拉") }}</option>
          <option value="dessert">{{ translateUi("点心、饮料") }}</option>
        </select></FormField>
      <div class="stack">
        <p>{{ translateUi("食谱等级") }}</p>
        <p class="muted">{{ translateUi("每个食谱单独填写，未填按 1 级。") }}</p>
        <details v-for="g in recipeGroups" :key="g.id" class="recipe-levels">
          <summary>{{ translateUi(g.label) }} · {{ g.recipes.length }} {{ translateUi("道") }}</summary>
          <div v-for="r in g.recipes" :key="r.name" class="recipe-lv-row">
            <MealIcon :name="r.name" />
            <span>{{ gameText(r.name) }}</span>
            <input
              :value="recipeLevelOf(settings, r.name)"
              type="number"
              :min="INPUT_LIMITS.recipeLevelOf_settings_r_name.min"
              :max="RECIPE_LEVEL_MAX"
              @change="setRecipeLevel(r.name, Number(($event.target as HTMLInputElement).value))"
            >
          </div>
        </details>
      </div>
      <FormField v-slot="{ id }" :label="translateUi('锅容量')"><input :id="id" v-model.number="settings.potSize" type="number" :min="minPotSize" :max="maxPotSize"></FormField>
      <FormField v-slot="{ id }" :label="translateUi('活动倍率')"><select :id="id" v-model.number="eventMult">
          <option v-if="!EVENT_BONUSES.some(b => b.mult === eventMult)" :value="eventMult">{{ eventMult }}{{ translateUi("倍（活动）") }}</option>
          <option v-for="bonus in EVENT_BONUSES" :key="bonus.mult" :value="bonus.mult">{{ translateUi(bonus.label) }}</option>
        </select></FormField>
      <div class="field">
        <label for="sleep-event-mix">{{ translateUi("活动跨类型出现数量（睡姿模拟／宝宝效率）") }}</label>
        <select id="sleep-event-mix" v-model="mixMode">
          <option v-for="option in MIX_OPTIONS" :key="option.value" :value="option.value">{{ translateUi(option.label) }}</option>
        </select>
      </div>
      <p class="muted">{{ translateUi("活动按日期提供默认值；也可在各面板手动调整。") }}</p>
      <ActivitySettings />
      <FormField v-slot="{ id }" :label="translateUi('分析周期')"><select :id="id" v-model="settings.period">
          <option value="day">{{ translateUi("日产") }}</option>
          <option value="week">{{ translateUi("周产") }}</option>
        </select></FormField>
      <button class="btn ghost" type="button" @click="store.reset()">{{ translateUi("恢复默认") }}</button>
    </section>
  </div>
</template>
