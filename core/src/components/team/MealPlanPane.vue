<script setup lang="ts">
import Dialog from '#platform/Dialog.vue'
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useMealPlan } from '#platform/scorePlan'
import { boxLabel } from '../../calc/boxFilter'
import { ingredientImageId, ingredientLabel, recipeById } from '../../calc/catalogIds'
import { isMealHealer, MEAL_PLAN_NO_CANDIDATES, type MealPlanRequest } from '../../calc/mealPlan'
import { MEAL_TARGET } from '../../calc/mealSupply'
import { normalizeScoreOptions, scoreCandidates, type ScoreOptions } from '../../calc/scorePlan'
import { teamRestrictionError } from '../../calc/teamRestrictions'
import { textHit } from '../../calc/text'
import { useProductionActivity } from '../../composables/useProductionActivity'
import { loadJson, saveJson } from '../../storage'
import { useBoxStore } from '../../stores/box'
import { useSettingsStore } from '../../stores/settings'
import type { BoxPokemon } from '../../types'
import { formatSleepLength, gameText, t } from '../../ui/i18n'
import RecipePane from '../data/RecipePane.vue'
import IngredientIcon from '../shared/IngredientIcon.vue'
import MealIcon from '../shared/MealIcon.vue'
import ProgressDialog from '../shared/ProgressDialog.vue'
import ToggleField from '../shared/ToggleField.vue'
import MealCandidateRow from './MealCandidateRow.vue'
import PlanningInventory from './PlanningInventory.vue'

interface SavedPlan {
  bag: Record<string, number>
  unresolvedBag?: Record<string, number>
  recipeId: number
  autoSpace: boolean
  team: string[]
}

const store = useBoxStore()
const { settings } = storeToRefs(useSettingsStore())
const { enabled: activityEnabled, settings: planningSettings, error: activityError } =
  useProductionActivity('meal-plan', settings, () => 'research')
const storageKey = 'meal-plan-options-v1'
const plan = ref<SavedPlan>({ bag: {}, recipeId: 0, autoSpace: true, team: [] })
const ready = ref(false)
const loadError = ref(false)
const selectionError = ref('')
const choosingRecipe = ref(false)
const candidatePicker = ref<'recommended' | 'box' | null>(null)
const query = ref('')
const visible = ref(20)
const recipe = computed(() => recipeById(plan.value.recipeId))
const eligible = computed(() => scoreCandidates(store.pokemon).candidates)
const hasEligible = computed(() => store.ready && eligible.value.length > 0)
const byUid = computed(() => new Map(eligible.value.map(pokemon => [pokemon.uid, pokemon])))
const team = computed(() => plan.value.team.flatMap(uid => {
  const member = byUid.value.get(uid)
  return member ? [member] : []
}))
const teamIds = computed(() => new Set(team.value.map(member => member.uid)))
const full = computed(() => team.value.length >= 5)
const pickerRows = computed(() => eligible.value
  .filter(pokemon => !teamIds.value.has(pokemon.uid))
  .map(pokemon => ({ pokemon, name: gameText(boxLabel(pokemon)), healer: isMealHealer(pokemon) }))
  .filter(row => textHit(row.name, query.value) || textHit(boxLabel(row.pokemon), query.value))
  .sort((a, b) => Number(b.healer) - Number(a.healer) || a.name.localeCompare(b.name)))
watch(query, () => { visible.value = 20 })

onMounted(async () => {
  try {
    const saved = await loadJson<Partial<SavedPlan> | null>(storageKey, null)
    const prior = saved ?? await loadJson<Partial<ScoreOptions> | null>('score-options-v2', null)
      ?? await loadJson<Partial<ScoreOptions> | null>('score-options-v1', null)
    const inventory = normalizeScoreOptions(prior ?? undefined, settings.value)
    plan.value = {
      bag: inventory.bag, unresolvedBag: inventory.unresolvedBag,
      recipeId: recipeById(saved?.recipeId)?.id ?? 0, autoSpace: saved?.autoSpace !== false,
      team: Array.isArray(saved?.team) ? [...new Set(saved.team.filter(uid => typeof uid === 'string'))].slice(0, 5) : [],
    }
  } catch { loadError.value = true }
  finally { ready.value = true }
})
watch(plan, value => {
  if (ready.value) void saveJson(storageKey, value).then(() => { loadError.value = false }, () => { loadError.value = true })
}, { deep: true })

function request(scope: MealPlanRequest['scope']): MealPlanRequest {
  return {
    mode: 'meal', scope, recipeId: plan.value.recipeId, settings: planningSettings.value,
    box: scope === 'team' ? team.value : store.pokemon, team: scope === 'team' ? team.value.map(pokemon => pokemon.uid) : [],
    bag: plan.value.bag, unresolvedBag: plan.value.unresolvedBag, autoSpace: plan.value.autoSpace,
  }
}
const listTask = useMealPlan(() => request('individuals'))
const teamTask = useMealPlan(() => request('team'))
const activeTask = computed(() => listTask.busy.value ? listTask : teamTask.busy.value ? teamTask : null)
const busy = computed(() => activeTask.value !== null)
const progress = computed(() => {
  const value = activeTask.value?.progress.value
  return value ? 100 * value.completed / Math.max(1, value.total) : 0
})
const notice = computed(() => activeTask.value?.notice.value ?? '')
const resultList = computed(() => {
  const result = listTask.result.value
  if (listTask.dirty.value || result?.scope !== 'individuals') return null
  return result.candidates.flatMap(estimate => {
    const pokemon = byUid.value.get(estimate.uid)
    return pokemon && !teamIds.value.has(pokemon.uid) ? [{ pokemon, estimate }] : []
  })
})
const pickerOpen = computed(() => choosingRecipe.value || hasEligible.value && !full.value && !busy.value &&
  (candidatePicker.value === 'box' || candidatePicker.value === 'recommended' && resultList.value !== null))
const pickerTitle = computed(() => choosingRecipe.value ? '选择食谱'
  : candidatePicker.value === 'box' ? '从 Box 选择队员' : 'Box 供料个体')
const estimate = computed(() => {
  const result = teamTask.result.value
  return !teamTask.dirty.value && result?.scope === 'team' ? result.estimate : null
})
const missing = computed(() => Object.entries(estimate.value?.missing ?? {}).filter(([, amount]) => amount > 0))
const pct = (ratio: number) => (ratio * 100).toFixed(1)
const foodName = (key: string) => gameText(ingredientLabel(key))

function closePicker() {
  choosingRecipe.value = false
  candidatePicker.value = null
  selectionError.value = ''
}

function openCandidates(mode: 'recommended' | 'box', refresh = false) {
  if (!ready.value || !hasEligible.value || busy.value || full.value) return
  closePicker()
  candidatePicker.value = mode
  if (mode === 'recommended' && (refresh || resultList.value === null)) void listTask.calculate()
}

function removeMember(member: BoxPokemon) {
  if (busy.value || !teamIds.value.has(member.uid)) return
  plan.value.team = team.value.filter(pokemon => pokemon.uid !== member.uid).map(pokemon => pokemon.uid)
  openCandidates(recipe.value ? 'recommended' : 'box')
}

function addMember(member: BoxPokemon) {
  if (busy.value || full.value || teamIds.value.has(member.uid)) return
  selectionError.value = ''
  const next = [...team.value, member]
  const invalid = teamRestrictionError(next)
  if (invalid) { selectionError.value = invalid; return }
  plan.value.team = next.map(pokemon => pokemon.uid)
  if (full.value) closePicker()
}

function pick(id: number) {
  plan.value.recipeId = id
  closePicker()
}
</script>

<template>
  <div class="stack meal-plan">
    <section class="card stack">
      <h3>{{ t('设置') }}</h3>
      <PlanningInventory v-model:bag="plan.bag" v-model:unresolved="plan.unresolvedBag" :disabled="!ready || busy" />
      <ToggleField v-model="activityEnabled" label="计入活动加成" :disabled="busy" />
      <ToggleField v-model="plan.autoSpace" label="自动腾空间" :disabled="busy" />
      <p v-if="activityError" role="alert" class="amber">{{ t(activityError) }}</p>
      <p v-if="loadError" role="alert" class="amber">{{ t('料理规划设置未能读取或保存') }}</p>
      <p class="muted">{{ t('全天产出即收 · 最多模拟 7 天 · 耗时取模拟中位数') }}</p>
    </section>

    <section class="card stack">
      <button type="button" class="btn ghost meal-plan-recipe-button" :disabled="busy || !ready"
        :aria-expanded="choosingRecipe" @click="choosingRecipe = true">
        <template v-if="recipe">
          <span aria-hidden="true"><MealIcon :id="recipe.id" :name="recipe.name" /></span>
          <strong>{{ gameText(recipe.name) }}</strong>
        </template>
        <template v-else>{{ t('选择食谱') }}</template>
        <span aria-hidden="true" class="meal-plan-recipe-arrow">›</span>
      </button>
      <div v-if="recipe" class="meal-plan-selection">
        <p class="muted">{{ t('三顿所需食材') }}</p>
        <div class="row meal-plan-foods">
          <span v-for="food in recipe.ingredients" :key="food.id" class="row">
            <IngredientIcon :id="food.id" :name="food.name" small />{{ gameText(food.name) }} ×{{ food.count * MEAL_TARGET }}
          </span>
        </div>
      </div>
      <button v-if="recipe && !full" type="button" class="btn" :disabled="!ready || busy || !hasEligible" @click="openCandidates('recommended', true)">{{ t('推荐') }}</button>
      <p v-if="store.ready && !hasEligible" class="muted" role="status">{{ t(MEAL_PLAN_NO_CANDIDATES) }}</p>
      <p v-else-if="!full && listTask.error.value" role="alert" class="amber">{{ t(listTask.error.value) }}</p>
      <p v-if="hasEligible && !full && listTask.dirty.value" class="muted">{{ t('参数已修改，请重新计算更新结果。') }}</p>
    </section>

    <section v-if="hasEligible && (resultList || team.length)" class="card stack">
      <div class="row meal-plan-between">
        <h3 :aria-label="t('队伍') + ' ' + team.length + '/5'">{{ team.length }}/5</h3>
        <button v-if="!full" type="button" class="btn ghost" :disabled="busy || !ready" :aria-expanded="pickerOpen && candidatePicker === 'box'" @click="openCandidates('box')">{{ t('从 Box 选择队员') }}</button>
      </div>
      <div v-for="member in team" :key="member.uid" class="row meal-plan-between">
        <span>{{ gameText(boxLabel(member)) }} · Lv.{{ member.level }}<template v-if="isMealHealer(member)"> · {{ t('回复活力') }}</template></span>
        <button type="button" class="btn ghost" :disabled="busy" @click="removeMember(member)">{{ t('移出队伍') }}</button>
      </div>
    </section>

    <section v-if="estimate || teamTask.error.value || teamTask.dirty.value" class="card stack">
      <h3>{{ t('计算结果') }}</h3>
      <p v-if="teamTask.error.value" role="alert" class="amber">{{ t(teamTask.error.value) }}</p>
      <p v-if="teamTask.dirty.value" class="muted">{{ t('参数已修改，请重新计算更新结果。') }}</p>
      <template v-if="estimate">
        <p><strong>{{ t('24 小时内备齐三顿的概率 · {percent}%', { percent: pct(estimate.dayChance) }) }}</strong></p>
        <p v-if="estimate.dayChance < 1" class="amber">{{ t('当天可能无法备齐三顿') }}</p>
        <div class="meal-milestones">
          <p v-for="(minute, i) in estimate.milestones" :key="i">
            {{ minute == null ? t('第 {meal} 顿 · 7 天内多数未达标', { meal: i + 1 })
              : minute === 0 ? t('开始时可吃第 {meal} 顿', { meal: i + 1 })
                : t('开始后 {time} 可吃第 {meal} 顿', { time: formatSleepLength(minute), meal: i + 1 }) }}
          </p>
        </div>
        <p v-if="estimate.milestones[2] == null && missing.length" class="amber">
          {{ t('7 天后的食材缺口 · {foods}', { foods: missing.map(([key, amount]) => foodName(key) + ' ×' + amount).join('、') }) }}
        </p>
        <div class="stack meal-plan-result-detail">
          <h4>{{ t('整队首日食谱覆盖率') }}</h4>
          <div v-for="(coverage, key) in estimate.coverage" :key="key" class="row meal-plan-between">
            <span class="row"><IngredientIcon :id="ingredientImageId(key)" :name="ingredientLabel(key)" small />{{ foodName(key) }}</span>
            <strong :class="{ amber: coverage < 1 }">{{ pct(coverage) }}%</strong>
          </div>
          <h4>{{ t('各成员最后交付食材的时间') }}</h4>
          <div v-for="member in team" :key="member.uid" class="row meal-plan-between">
            <span>{{ gameText(boxLabel(member)) }} · Lv.{{ member.level }}</span>
            <span>{{ estimate.contributions[member.uid] == null
              ? t(isMealHealer(member) ? '辅助' : '暂无交付时间')
              : formatSleepLength(estimate.contributions[member.uid]!) }}</span>
          </div>
          <p v-if="estimate.overflow || estimate.sold" class="muted">
            {{ t('卖出 {sold} 个 · 溢出 {overflow} 个', { sold: estimate.sold, overflow: estimate.overflow }) }}
          </p>
        </div>
      </template>
    </section>
    <button type="button" class="btn" :disabled="!ready || busy || !hasEligible || !recipe || !team.length" @click="teamTask.calculate()">{{ t('计算耗时') }}</button>

    <Dialog v-if="pickerOpen" variant="picker"
      :title="t(pickerTitle) + (choosingRecipe ? '' : ' · ' + team.length + '/5')" @close="closePicker">
      <div class="meal-recipe-picker-viewport">
        <div class="meal-recipe-picker-scroll">
          <RecipePane v-if="choosingRecipe" selectable :selected-id="plan.recipeId" @pick="pick" />
          <div v-else class="stack">
            <p v-if="selectionError" role="alert" class="amber">{{ t(selectionError) }}</p>
            <template v-if="candidatePicker === 'box'">
              <input v-model="query" class="picker-search" :placeholder="t('搜索 Box 个体')" :aria-label="t('搜索 Box 个体')">
              <p v-if="!pickerRows.length" class="muted">{{ t('暂无可上场的个体') }}</p>
              <div v-for="{ pokemon, name, healer } in pickerRows.slice(0, visible)" :key="pokemon.uid" class="row meal-plan-between">
                <span>{{ name }} · Lv.{{ pokemon.level }}<template v-if="healer"> · {{ t('回复活力') }}</template></span>
                <button type="button" class="btn ghost" @click="addMember(pokemon)">{{ t('加入队伍') }}</button>
              </div>
              <button v-if="visible < pickerRows.length" type="button" class="btn ghost" @click="visible += 20">{{ t('加载更多') }}</button>
            </template>
            <template v-else>
              <p class="muted">{{ t(resultList?.length ? '按所选料理的食谱覆盖率排序，分食材显示三顿用量的达标时间。' : 'Box 中暂无能提供目标食材的可用个体') }}</p>
              <MealCandidateRow v-for="{ pokemon, estimate: candidate } in resultList" :key="pokemon.uid"
                :pokemon="pokemon" :estimate="candidate" @add="addMember(pokemon)" />
            </template>
          </div>
        </div>
      </div>
    </Dialog>
    <ProgressDialog :open="busy" title="正在计算料理规划" :progress="progress" :notice="notice" cancellable @cancel="activeTask?.cancel()" />
  </div>
</template>

<style scoped>
.meal-plan-between { justify-content: space-between; flex-wrap: wrap; }
.meal-plan-recipe-button { display: flex; align-items: center; gap: 8px; min-height: 44px; text-align: start; }
.meal-plan-recipe-arrow { margin-left: auto; }
.meal-recipe-picker-viewport { flex: 1; min-height: 0; min-width: 0; position: relative; }
.meal-recipe-picker-scroll { position: absolute; top: 0; left: 0; width: 100%; height: 100%; overflow-y: auto; overscroll-behavior-y: contain; }
.meal-plan-selection p { margin: 6px 0; }
.meal-plan-foods { flex-wrap: wrap; }
.meal-plan-foods .row { gap: 4px; }
.meal-milestones { padding: 8px 0; border-block: 1px solid var(--line); }
.meal-milestones p, .meal-plan-result-detail h4 { margin: 4px 0; }
.meal-plan-result-detail { font-variant-numeric: tabular-nums; }
</style>
