<script setup lang="ts">
import clientDefaults from '../../data/client-defaults.resource'

import { computed, shallowRef } from 'vue'
import { storeToRefs } from 'pinia'
import { ACTIVITY_FIELDS, activeActivities, activityFeatures, activityValues, type NumericActivityField } from '../../calc/activities'
import { useActivities } from '../../composables/useActivities'
import { useSettingsStore } from '../../stores/settings'
const components_shared_ActivitySettings_config_clientDefaults = clientDefaults.modules.components_shared_ActivitySettings


const { settings } = storeToRefs(useSettingsStore())
const activity = useActivities(settings, () => settings.value.island, undefined, () => settings.value.period)
const allRecipes = activity.field('allRecipeCategories')
const expanded = shallowRef(components_shared_ActivitySettings_config_clientDefaults["expandedInitial"])
const fields = Object.keys(ACTIVITY_FIELDS) as NumericActivityField[]
const controls = Object.fromEntries(fields.map(key => [key, activity.field(key, key === 'drowsyPowerMultiplier' ? () => settings.value.eventMult : undefined)]))
const features = computed(() => activityFeatures(activity.context.value, undefined, 240, settings.value.island))
const fixedDrops = computed(() => Object.keys(activityValues(activity.context.value, settings.value.island).fixedIngredientDrops))
const names = computed(() => activeActivities(activity.context.value).map(event => event.name).join('、'))
function edit(key: NumericActivityField, value: string) {
  if (value === '') { activity.reset(key); return }
  const n = Number(value)
  if (Number.isFinite(n) && n >= ACTIVITY_FIELDS[key].min && n <= (key === 'cookingCritBonus' ? 1 : 10000) && (key !== 'skillLevelBonus' || Number.isInteger(n))) controls[key]!.value = n
}
</script>

<template>
  <div class="stack">
    <button class="btn ghost" type="button" :aria-expanded="expanded" @click="expanded = !expanded">{{ expanded ? '收起活动加成' : '活动加成与手动调整' }}</button>
    <div v-if="expanded" class="stack">
      <p class="muted">{{ names || '周期首日没有配置活动' }} · {{ activity.context.value.startDate }} 起。按设备本地时间凌晨 04:00 切日，周模拟逐日应用；手动值覆盖对应项目。</p>
      <label class="row"><input v-model="allRecipes" type="checkbox">全料理类型可制作</label>
      <p v-if="fixedDrops.length" class="muted">额外食材：{{ fixedDrops.join('、') }}。未公布能量的食材只统计数量，相关料理收益提示资料未公布。</p>
      <p v-for="feature in features" :key="feature.id" class="muted">{{ feature.name }}：{{ feature.status === 'informational' ? '资料已记录' : feature.description }}</p>
      <div v-for="key in fields" :key="key" class="field">
        <label :for="`activity-${key}`">{{ ACTIVITY_FIELDS[key].label }}{{ settings.activity?.overrides?.[key] != null ? '（手动）' : '（自动）' }}</label>
        <div class="row">
          <input :id="`activity-${key}`" type="number" :min="ACTIVITY_FIELDS[key].min" :max="key === 'cookingCritBonus' ? 1 : 10000" :step="key === 'skillLevelBonus' ? 1 : 'any'" :value="controls[key]?.value" @change="edit(key, ($event.target as HTMLInputElement).value)">
          <button class="btn ghost" type="button" @click="activity.reset(key)">自动</button>
        </div>
      </div>
      <button class="btn ghost" type="button" @click="activity.reset()">全局加成恢复自动</button>
    </div>
  </div>
</template>
