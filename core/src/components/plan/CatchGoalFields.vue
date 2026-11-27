<script setup lang="ts">
import { computed } from 'vue'
import PokePicker from '#platform/PokePicker.vue'
import type { CatchGoal } from '../../calc/catch'
import { sleepdexState } from '../../calc/sleep'
import { t as translateUi } from '../../ui/i18n'

const props = defineProps<{ goal: CatchGoal; eligibleIds: readonly number[]; discovered: readonly number[]; position?: number }>()
const coverage = computed(() => sleepdexState(props.goal.pokeId, props.discovered))

function toggleStar(star: number) {
  if (!coverage.value.missing.includes(star)) return
  const stars = new Set(props.goal.stars)
  if (stars.has(star)) stars.delete(star)
  else stars.add(star)
  props.goal.stars = [...stars].sort((a, b) => a - b)
}
</script>

<template>
  <div :class="position == null ? 'stack' : 'plan-goal-top'">
    <span v-if="position != null" class="muted">{{ position }}</span>
    <PokePicker v-model="goal.pokeId" :allowed-ids="eligibleIds" />
    <p v-if="!eligibleIds.includes(goal.pokeId)" class="muted">{{ translateUi("此目标暂不可参与抽选") }}</p>
    <select v-model="goal.purpose" :aria-label="translateUi('用途')">
      <option value="catch">{{ translateUi("捕捉") }}</option>
      <option value="sleep">{{ translateUi("睡姿") }}</option>
      <option value="candy">{{ translateUi("刷糖") }}</option>
    </select>
  </div>
  <p v-if="goal.purpose === 'sleep' && coverage.complete" class="amber">{{ translateUi("该宝可梦睡姿已集齐") }}</p>
  <p v-else-if="goal.purpose === 'sleep' && !coverage.stars.length" class="muted">{{ translateUi("资料未收录这只宝可梦的睡姿") }}</p>
  <div v-else-if="goal.purpose === 'sleep'" class="picker-opts">
    <button
      v-for="star in coverage.stars"
      :key="star"
      type="button"
      :disabled="!coverage.missing.includes(star)"
      :class="{ on: goal.stars.includes(star) && coverage.missing.includes(star) }"
      @click="toggleStar(star)"
    >{{ star }}★<template v-if="!coverage.missing.includes(star)"> {{ translateUi("已发现") }}</template></button>
  </div>
</template>
