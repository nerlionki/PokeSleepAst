<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { storeToRefs } from 'pinia'
import { usePlanStore } from '../../stores/plans'
import { useSettingsStore } from '../../stores/settings'
import { useActivities } from '../../composables/useActivities'
import { newEncounterGoal, type EncounterGoal } from '../../calc/encounterPlan'
import { CATCH_MODES, recommendThree, type CatchPurpose } from '../../calc/catch'
import { resolvedSleepdex, styleKey } from '../../calc/sleep'
import { activitySleepStyles } from '../../calc/activities'
import { POKEDEX, SLEEP_STYLES } from '../../calc/data'
import { BABY_POKEMON_NAMES } from '../../calc/babyEfficiency'
import EncounterTargetPane from './EncounterTargetPane.vue'

const { plan } = storeToRefs(usePlanStore())
const { settings } = storeToRefs(useSettingsStore())
const activity = useActivities(settings, () => settings.value.island)
const goals = computed(() => plan.value.encounterGoals)
const selectedId = shallowRef('')
const selected = computed(() => goals.value.find(goal => goal.id === selectedId.value))
const busy = shallowRef(false)
const recommendationMode = shallowRef('all')
const recommendations = shallowRef<ReturnType<typeof recommendThree> | null>(null)
const stamp = shallowRef('')
const styles = computed(() => activitySleepStyles(SLEEP_STYLES, activity.context.value))
const purposeNames: Record<CatchPurpose, string> = { catch: '捕捉', candy: '刷糖', sleep: '睡姿' }
const catchGoals = computed(() => goals.value.map(goal => {
  const style = styles.value.find(style => styleKey(style.pokeId, style.stars, style.styleId) === goal.options.completionTarget)
  return { id: goal.id, pokeId: goal.options.pokeId, purpose: goal.purpose, stars: style ? [style.stars] : [] }
}))
const fingerprint = computed(() => JSON.stringify({ goals: catchGoals.value, mode: recommendationMode.value, dex: resolvedSleepdex(plan.value), activity: activity.context.value }))

function label(goal: EncounterGoal) {
  const name = (goal.purpose !== 'sleep' ? BABY_POKEMON_NAMES[goal.options.pokeId] : '') || POKEDEX.find(poke => poke.id === goal.options.pokeId)?.name || '请选择宝可梦'
  if (goal.purpose !== 'sleep') return name
  const style = styles.value.find(style => styleKey(style.pokeId, style.stars, style.styleId) === goal.options.completionTarget)
  return style ? `${name} · ${style.stars}★ ${style.styleName}` : `${name} · 待选择睡姿`
}
function add(purpose: CatchPurpose) {
  if (busy.value) return
  const goal = newEncounterGoal(purpose)
  goals.value.push(goal)
  selectedId.value = goal.id
}
function remove(id: string) {
  if (busy.value) return
  plan.value.encounterGoals = goals.value.filter(goal => goal.id !== id)
  if (selectedId.value === id) selectedId.value = ''
}
function move(index: number, step: number) {
  if (busy.value) return
  const next = index + step
  if (next < 0 || next >= goals.value.length) return
  const [goal] = goals.value.splice(index, 1)
  goals.value.splice(next, 0, goal!)
}
function recommend() {
  recommendations.value = recommendThree(catchGoals.value, resolvedSleepdex(plan.value), [recommendationMode.value], activity.context.value)
  stamp.value = fingerprint.value
}
</script>

<template>
  <div class="stack encounter-planner">
    <header class="stack">
      <h3>我的遇见目标</h3>
      <p class="muted">先列出目标，再选中一个计算。捕捉仅支持一阶段宝可梦；刷糖统计家族研究糖果。</p>
      <div class="row goal-actions">
        <button class="btn" type="button" :disabled="busy" @click="add('catch')">添加捕捉</button>
        <button class="btn" type="button" :disabled="busy" @click="add('candy')">添加刷糖</button>
        <button class="btn" type="button" :disabled="busy" @click="add('sleep')">添加睡姿</button>
      </div>
    </header>
    <p v-if="!goals.length" class="muted">还没有目标。添加后可选择宝可梦或具体睡姿，目标会自动保存。</p>
    <div v-if="goals.length" class="goal-list stack" aria-label="遇见目标列表">
      <article v-for="(goal, index) in goals" :key="goal.id" class="card encounter-goal" :class="{ selected: selectedId === goal.id }">
        <button class="goal-select" type="button" :disabled="busy" :aria-pressed="selectedId === goal.id" @click="selectedId = goal.id">
          <span class="muted">{{ index + 1 }} · {{ purposeNames[goal.purpose] }}</span>
          <strong>{{ label(goal) }}</strong>
          <span class="muted">{{ selectedId === goal.id ? '已选中 · 在下方设置并计算' : '选择此目标' }}</span>
        </button>
        <div class="row goal-actions">
          <button class="btn ghost" type="button" :disabled="busy || index === 0" :aria-label="'上移' + label(goal)" @click="move(index, -1)">上移</button>
          <button class="btn ghost" type="button" :disabled="busy || index === goals.length - 1" :aria-label="'下移' + label(goal)" @click="move(index, 1)">下移</button>
          <button class="btn ghost" type="button" :disabled="busy" :aria-label="'删除' + label(goal)" @click="remove(goal.id)">删除</button>
        </div>
      </article>
    </div>
    <EncounterTargetPane v-if="selected" :key="selected.id" :goal="selected" @busy="busy = $event" />
    <p v-else-if="goals.length" class="muted">选择一个目标，设置参数并计算它的效率。</p>
    <section v-if="goals.length" class="stack encounter-coverage">
      <h3>多目标选岛推荐</h3>
      <p class="muted">按列表顺序和岛屿覆盖评分，排在前面的目标优先。此评分不代表遇见概率；睡姿按星级覆盖匹配，已发现的睡姿会跳过。</p>
      <div class="field"><label for="encounter-mode">推荐类型</label><select id="encounter-mode" v-model="recommendationMode" :disabled="busy"><option v-for="mode in CATCH_MODES" :key="mode.id" :value="mode.id">{{ mode.name }}</option></select></div>
      <button class="btn" type="button" :disabled="busy" @click="recommend">生成选岛推荐</button>
      <p v-if="recommendations && stamp !== fingerprint" class="amber">目标、图鉴或活动已修改，请重新生成推荐。</p>
      <section v-for="column in recommendations" :key="column.id" class="stack">
        <h4>{{ column.name }}</h4>
        <p v-if="column.id === 'all'" class="muted">捕捉 ×1.2 · 刷糖 ×1 · 睡姿 ×0.8～0.9；萌绿之岛和 EX 排在其他岛之后。</p>
        <p v-if="!column.results.length" class="muted">当前没有命中的岛屿，请检查目标和睡姿图鉴。</p>
        <article v-for="pick in column.results" :key="pick.islandId" class="card stack">
          <strong>{{ pick.island }} · 命中 {{ pick.count }} · 覆盖评分 {{ pick.score }}</strong>
          <div v-for="group in pick.sleepGroups" :key="group.sleepType" class="stack">
            <span class="muted">{{ group.sleepType }}</span>
            <div class="row"><span v-for="(match, index) in group.matches" :key="index" class="chip">{{ match.name }} · {{ match.stars.length ? match.stars.map(star => star + '★').join(' ') : purposeNames[match.purpose] }}</span></div>
          </div>
        </article>
      </section>
    </section>
  </div>
</template>

<style scoped>
.goal-actions { flex-wrap: wrap; }
.encounter-goal { padding: 0; overflow: hidden; }
.encounter-goal.selected { border-color: var(--sage); }
.goal-select { width: 100%; display: flex; flex-direction: column; align-items: flex-start; gap: 6px; padding: 14px; text-align: left; background: transparent; color: inherit; border: 0; border-radius: 0; }
.goal-select strong { overflow-wrap: anywhere; }
.encounter-goal .goal-actions { padding: 0 14px 14px; }
.encounter-coverage { border-top: 1px solid var(--line); padding-top: 20px; }
</style>
