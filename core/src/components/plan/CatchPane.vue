<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { storeToRefs } from 'pinia'
import { recommendThree, type CatchGoal, type CatchPurpose } from '../../calc/catch'
import { resolvedSleepdex, sleepdexState } from '../../calc/sleep'
import { usePlanStore } from '../../stores/plans'
import PokePicker from '../shared/PokePicker.vue'

const planStore = usePlanStore()
const { plan } = storeToRefs(planStore)
const columns = shallowRef<ReturnType<typeof recommendThree> | null>(null)
const stamped = shallowRef('')

const discovered = computed(() => resolvedSleepdex(plan.value))
const fingerprint = computed(() => JSON.stringify({
  goals: plan.value.catchGoals,
  mode: plan.value.sleepdexMode,
  dex: plan.value.sleepdex,
  excluded: plan.value.sleepdexExcluded,
}))
const dirty = computed(() => stamped.value !== '' && stamped.value !== fingerprint.value)

function addGoal() {
  plan.value.catchGoals.push({
    id: crypto.randomUUID(),
    pokeId: 1,
    purpose: 'catch',
    stars: [],
  })
}

function removeGoal(id: string) {
  plan.value.catchGoals = plan.value.catchGoals.filter((goal) => goal.id !== id)
}

function moveGoal(index: number, step: number) {
  const next = index + step
  const rows = plan.value.catchGoals
  if (next < 0 || next >= rows.length) return
  const [row] = rows.splice(index, 1)
  rows.splice(next, 0, row)
}

function toggleStar(goal: CatchGoal, star: number) {
  if (!coverage(goal.pokeId).missing.includes(star)) return
  const set = new Set(goal.stars)
  if (set.has(star)) set.delete(star)
  else set.add(star)
  goal.stars = [...set].sort((a, b) => a - b)
}

function coverage(pokeId: number) {
  return sleepdexState(pokeId, discovered.value)
}

function generate() {
  columns.value = recommendThree(plan.value.catchGoals, discovered.value)
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
    <p class="muted">上面的目标优先。综合列捕捉 ×1.2、刷糖 ×1，睡姿按命中星级 ×0.8～0.9。已在睡姿图鉴发现的星级会自动跳过。萌绿之岛和 EX 排在其他岛后面。</p>
    <div class="row">
      <button class="btn" type="button" @click="addGoal">新增目标</button>
      <button class="btn sage" type="button" :disabled="!plan.catchGoals.length" @click="generate">生成三列推荐</button>
    </div>
    <p v-if="columns && dirty" class="amber">目标已修改，点击生成更新推荐</p>
    <article v-for="(goal, index) in plan.catchGoals" :key="goal.id" class="card plan-goal">
      <div class="plan-goal-top">
        <span class="muted">{{ index + 1 }}</span>
        <PokePicker v-model="goal.pokeId" />
        <select v-model="goal.purpose" aria-label="用途">
          <option value="catch">捕捉</option>
          <option value="sleep">睡姿</option>
          <option value="candy">刷糖</option>
        </select>
      </div>
      <p v-if="goal.purpose === 'sleep' && coverage(goal.pokeId).complete" class="amber">该宝可梦睡姿已集齐</p>
      <p v-else-if="goal.purpose === 'sleep' && !coverage(goal.pokeId).stars.length" class="muted">资料未收录这只宝可梦的睡姿</p>
      <div v-else-if="goal.purpose === 'sleep'" class="picker-opts">
        <button
          v-for="star in coverage(goal.pokeId).stars"
          :key="star"
          type="button"
          :disabled="!coverage(goal.pokeId).missing.includes(star)"
          :class="{ on: goal.stars.includes(star) && coverage(goal.pokeId).missing.includes(star) }"
          @click="toggleStar(goal, star)"
        >{{ star }}★<template v-if="!coverage(goal.pokeId).missing.includes(star)"> 已发现</template></button>
      </div>
      <div class="row">
        <button class="btn ghost" type="button" :disabled="index === 0" @click="moveGoal(index, -1)">上移</button>
        <button class="btn ghost" type="button" :disabled="index === plan.catchGoals.length - 1" @click="moveGoal(index, 1)">下移</button>
        <button class="btn ghost" type="button" @click="removeGoal(goal.id)">删除</button>
      </div>
    </article>
    <p v-if="!plan.catchGoals.length" class="muted">新增目标，选择捕捉、睡姿或刷糖。睡姿要勾选星级。</p>
    <section v-for="col in columns" :key="col.id" class="stack">
      <h3>{{ col.name }}</h3>
      <p v-if="col.id === 'all'" class="muted">用途加权：捕捉 ×1.2 · 刷糖 ×1 · 睡姿 ×0.8～0.9</p>
      <p v-if="!col.results.length" class="muted">这一列没有命中。</p>
      <article v-for="pick in col.results" :key="pick.islandId" class="card rec-card">
        <header class="row">
          <strong>{{ pick.island }}</strong>
          <span class="muted">命中 {{ pick.count }} · {{ pick.score }}</span>
        </header>
        <div v-for="group in pick.sleepGroups" :key="group.sleepType" class="rec-sleep">
          <span>{{ group.sleepType }}</span>
          <div class="rec-matches">
            <span v-for="match in group.matches" :key="match.purpose + match.pokeId" class="chip">
              {{ match.name }}
              {{ match.stars.length ? match.stars.map((star) => star + '★').join(' ') : purposeLabel(match.purpose) }}
            </span>
          </div>
        </div>
      </article>
    </section>
  </div>
</template>
