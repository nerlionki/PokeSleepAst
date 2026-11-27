<script setup lang="ts">
import { gameText, t as translateUi } from '../../ui/i18n'


import { confirmRemoval } from '#platform/confirm'
import clientDefaults from '../../data/client-defaults.resource'

import { newUid } from '../../calc/uid'
import { computed, ref, shallowRef } from 'vue'
import { storeToRefs } from 'pinia'
import { CATCH_MODES, recommendThree, type CatchGoal, type CatchPurpose } from '../../calc/catch'
import { resolvedSleepdex } from '../../calc/sleep'
import { usePlanStore } from '../../stores/plans'
import { useSettingsStore } from '../../stores/settings'
import { useEncounterActivity } from '../../composables/useEncounterAvailability'
import { useActivities } from '../../composables/useActivities'
import { researchSleepStyles } from '../../calc/activities'
import { SLEEP_STYLES } from '../../calc/data'
import CatchGoalFields from './CatchGoalFields.vue'
import Dialog from '#platform/Dialog.vue'
const components_plan_CatchPane_config_clientDefaults = clientDefaults.modules.components_plan_CatchPane


const planStore = usePlanStore()
const { plan } = storeToRefs(planStore)
const { settings } = storeToRefs(useSettingsStore())
const activity = useActivities(settings, () => settings.value.island)
const research = useEncounterActivity(activity.context)
const eligibleIds = computed(() => [...new Set(researchSleepStyles(SLEEP_STYLES, research.value).map(style => style.pokeId))])
const columns = shallowRef<ReturnType<typeof recommendThree> | null>((components_plan_CatchPane_config_clientDefaults["columnsInitial"] as unknown as ReturnType<typeof recommendThree> | null))
const stamped = shallowRef(components_plan_CatchPane_config_clientDefaults["stampedInitial"])
const selectedMode = shallowRef(components_plan_CatchPane_config_clientDefaults["selectedModeInitial"])

const discovered = computed(() => resolvedSleepdex(plan.value))
const fingerprint = computed(() => JSON.stringify({
  recommendation: selectedMode.value,
  goals: plan.value.catchGoals,
  mode: plan.value.sleepdexMode,
  dex: plan.value.sleepdex,
  excluded: plan.value.sleepdexExcluded,
  activity: research.value,
}))
const dirty = computed(() => stamped.value !== '' && stamped.value !== fingerprint.value)
const draft = ref<CatchGoal | null>(null)

function addGoal() {
  draft.value = {
    id: newUid(),
    pokeId: eligibleIds.value.includes(1) ? 1 : eligibleIds.value[0] ?? 1,
    purpose: 'catch',
    stars: [],
  }
}

function saveGoal() {
  if (!draft.value || !eligibleIds.value.includes(draft.value.pokeId)) return
  plan.value.catchGoals.push(draft.value)
  draft.value = null
}

async function removeGoal(id: string) {
  if (!await confirmRemoval('确认删除此捕捉刷糖目标？')) return
  plan.value.catchGoals = plan.value.catchGoals.filter((goal) => goal.id !== id)
}

function moveGoal(index: number, step: number) {
  const next = index + step
  const rows = plan.value.catchGoals
  if (next < 0 || next >= rows.length) return
  const [row] = rows.splice(index, 1)
  rows.splice(next, 0, row)
}

function generate() {
  columns.value = recommendThree(plan.value.catchGoals, discovered.value, [selectedMode.value], research.value)
  stamped.value = fingerprint.value
}

function purposeLabel(purpose: CatchPurpose) {
  if (purpose === 'candy') return '刷糖'
  if (purpose === 'sleep') return '睡姿'
  return '捕捉'
}
</script>

<template>
  <div class="stack">
    <p class="muted">{{ translateUi("上面的目标优先。综合推荐捕捉 ×1.2、刷糖 ×1，睡姿按命中星级 ×0.8～0.9。已在睡姿图鉴发现的星级会自动跳过。萌绿之岛和 EX 排在其他岛后面。") }}</p>
    <div class="field">
      <label for="catch-recommendation">{{ translateUi("推荐类型") }}</label>
      <select id="catch-recommendation" v-model="selectedMode">
        <option v-for="mode in CATCH_MODES" :key="mode.id" :value="mode.id">{{ translateUi(mode.name) }}</option>
      </select>
    </div>
    <div class="row">
      <button class="btn" type="button" aria-haspopup="dialog" @click="addGoal">{{ translateUi("新增目标") }}</button>
      <button class="btn sage" type="button" :disabled="!plan.catchGoals.some(goal => eligibleIds.includes(goal.pokeId))" @click="generate">{{ translateUi("生成推荐") }}</button>
    </div>
    <Dialog v-if="draft" :title="translateUi('新增目标')" @close="draft = null">
      <CatchGoalFields :goal="draft" :eligible-ids="eligibleIds" :discovered="discovered" />
      <template #footer>
        <button class="btn sage" type="button" :disabled="!eligibleIds.includes(draft.pokeId)" @click="saveGoal">{{ translateUi("完成") }}</button>
      </template>
    </Dialog>
    <p v-if="columns && dirty" class="amber">{{ translateUi("目标或推荐类型已修改，请重新生成") }}</p>
    <article v-for="(goal, index) in plan.catchGoals" :key="goal.id" class="card plan-goal">
      <CatchGoalFields :goal="goal" :eligible-ids="eligibleIds" :discovered="discovered" :position="index + 1" />
      <div class="row">
        <button class="btn ghost" type="button" :disabled="index === 0" @click="moveGoal(index, -1)">{{ translateUi("上移") }}</button>
        <button class="btn ghost" type="button" :disabled="index === plan.catchGoals.length - 1" @click="moveGoal(index, 1)">{{ translateUi("下移") }}</button>
        <button class="btn ghost" type="button" @click="removeGoal(goal.id)">{{ translateUi("删除") }}</button>
      </div>
    </article>
    <p v-if="!plan.catchGoals.length" class="muted">{{ translateUi("新增目标，选择捕捉、睡姿或刷糖。睡姿要勾选星级。") }}</p>
    <section v-for="col in columns" :key="col.id" class="stack">
      <h3>{{ translateUi(col.name) }}</h3>
      <p v-if="col.id === 'all'" class="muted">{{ translateUi("用途加权：捕捉 ×1.2 · 刷糖 ×1 · 睡姿 ×0.8～0.9") }}</p>
      <p v-if="!col.results.length" class="muted">{{ translateUi("这一列没有命中。") }}</p>
      <article v-for="pick in col.results" :key="pick.islandId" class="card rec-card">
        <header class="row">
          <strong>{{ pick.island }}</strong>
          <span class="muted">{{ translateUi("命中") }} {{ pick.count }} / {{ pick.score }}</span>
        </header>
        <div v-for="group in pick.sleepGroups.filter(group => group.matches.length)" :key="group.sleepType" class="rec-sleep">
          <span>{{ gameText(group.sleepType) }}</span>
          <div class="rec-matches">
            <span v-for="match in group.matches" :key="match.purpose + match.pokeId" class="chip">
              {{ gameText(match.name) }}
              {{ match.stars.length ? match.stars.map((star) => star + '★').join(' ') : purposeLabel(match.purpose) }}
            </span>
          </div>
        </div>
      </article>
    </section>
  </div>
</template>
