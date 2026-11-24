<script setup lang="ts">
import { computed } from 'vue'
import { boxLabel } from '../../calc/boxFilter'
import { ingredientImageId, ingredientLabel } from '../../calc/catalogIds'
import { pokeById } from '../../calc/data'
import { INGREDIENT_GATES, slotDrop } from '../../calc/ingredients'
import type { MealCandidate } from '../../calc/mealPlan'
import { resolveMemberSkill } from '../../calc/mew'
import type { BoxPokemon } from '../../types'
import { formatSleepLength, gameText, t } from '../../ui/i18n'
import IngredientIcon from '../shared/IngredientIcon.vue'
import PokeSprite from '../shared/PokeSprite.vue'

const props = defineProps<{ pokemon: BoxPokemon; estimate: MealCandidate; selected: boolean; disabled: boolean }>()
const emit = defineEmits<{ toggle: [] }>()
const species = computed(() => pokeById(props.pokemon.pokeId))
const skill = computed(() => species.value ? resolveMemberSkill(species.value, props.pokemon).name : '')
const slots = computed(() => INGREDIENT_GATES.map((level, index) => {
  const choice = props.pokemon.ingredientSlots[index]
  return { level, locked: props.pokemon.level < level,
    food: choice == null ? null : slotDrop(species.value?.ingredients ?? [], index, choice) }
}))
const combo = computed(() => slots.value.map(slot => slot.food?.letter ?? '—').join(''))
const foods = computed(() => Object.entries(props.estimate.coverage).map(([key, value]) => ({
  key, name: ingredientLabel(key), image: ingredientImageId(key), percent: (value * 100).toFixed(1),
  minutes: props.estimate.ingredientTimes[key],
})))
const duration = (time: number | null | undefined) => time == null ? t('7 天内多数未达标') : formatSleepLength(time)
</script>

<template>
  <div class="meal-candidate">
    <div class="meal-candidate-head">
      <PokeSprite :id="pokemon.pokeId" :name="boxLabel(pokemon)" :shiny="pokemon.shiny" />
      <div class="meal-identity">
        <strong>{{ gameText(boxLabel(pokemon)) }}</strong>
        <span class="muted">Lv.{{ pokemon.level }} · {{ combo }}</span>
      </div>
      <button type="button" class="btn ghost" :aria-pressed="selected" :disabled="disabled" @click="emit('toggle')">
        {{ t(selected ? '移出队伍' : '加入队伍') }}
      </button>
    </div>
    <div class="meal-candidate-meta">
      <span v-for="slot in slots" :key="slot.level" class="meal-slot" :class="{ locked: slot.locked }">
        <IngredientIcon v-if="slot.food" :id="slot.food.id" :name="slot.food.name" small />
        <span class="muted">Lv.{{ slot.level }}</span>
      </span>
      <span v-if="skill" class="muted">{{ gameText(skill) }}</span>
    </div>
    <div v-for="food in foods" :key="food.key" class="meal-candidate-food">
      <span><IngredientIcon :id="food.image" :name="food.name" small /> {{ gameText(food.name) }}</span>
      <span class="muted">{{ food.percent }}%</span>
      <strong>{{ duration(food.minutes) }}</strong>
    </div>
    <p v-if="foods.length > 1" class="muted">{{ t('所供食材全部达标 · {time}', { time: duration(estimate.minutes) }) }}</p>
    <p v-if="estimate.dayChance < 1" class="amber">{{ t('当天可能未达标') }}</p>
  </div>
</template>

<style scoped>
.meal-candidate { padding: 12px 0; border-top: 1px solid var(--line); }
.meal-candidate-head { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 8px; }
.meal-identity { display: grid; min-width: 0; overflow-wrap: anywhere; }
.meal-candidate-meta, .meal-slot, .meal-candidate-food > span:first-child { display: flex; align-items: center; gap: 4px; }
.meal-candidate-meta { flex-wrap: wrap; margin: 6px 0; gap: 6px 10px; font-size: var(--font-12); }
.meal-slot.locked { opacity: .55; }
.meal-candidate-food { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; align-items: center; gap: 8px; padding: 3px 0; font-variant-numeric: tabular-nums; }
.meal-candidate-food > span:first-child { min-width: 0; overflow-wrap: anywhere; }
.meal-candidate > p { margin: 6px 0 0; }
</style>
