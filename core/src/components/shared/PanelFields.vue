<script setup lang="ts">
import { computed } from 'vue'
import { NATURES, POKEDEX, SUBSKILLS, pokeById } from '../../calc/data'
import { POKEMON_LEVEL_MAX } from '../../calc/xp'
import { skillMaxFor } from '../../calc/mainSkills'
import type { ProduceInput } from '../../types'
import IngredientIcon from './IngredientIcon.vue'
import PokePicker from './PokePicker.vue'

const model = defineModel<ProduceInput>({ required: true })

const poke = computed(() => pokeById(model.value.pokeId) ?? POKEDEX[0]!)
const skillMax = computed(() => skillMaxFor(poke.value.mainSkill))

function setSlot(index: number, value: number) {
  const next: [number | null, number | null, number | null] = [model.value.ingredientSlots[0], model.value.ingredientSlots[1], model.value.ingredientSlots[2]]
  next[index] = value
  model.value = { ...model.value, ingredientSlots: next }
}

function setSub(index: number, value: string) {
  const next = [...model.value.subskills]
  next[index] = value
  model.value = { ...model.value, subskills: next }
}
</script>

<template>
  <div class="stack">
    <div class="field">
      <label>宝可梦</label>
      <PokePicker v-model="model.pokeId" />
    </div>
    <div class="field">
      <label>等级</label>
      <input v-model.number="model.level" type="number" min="1" :max="POKEMON_LEVEL_MAX">
    </div>
    <div class="field">
      <label>性格</label>
      <select v-model="model.nature">
        <option v-for="n in NATURES" :key="n.name" :value="n.name">{{ n.name }}</option>
      </select>
    </div>
    <div v-for="i in 5" :key="i" class="field">
      <label>副技能 {{ i }}</label>
      <select :value="model.subskills[i - 1] ?? ''" @change="setSub(i - 1, ($event.target as HTMLSelectElement).value)">
        <option value="">（空）</option>
        <option v-for="s in SUBSKILLS" :key="s.id" :value="s.id">{{ s.name }}</option>
      </select>
    </div>
    <div v-for="(ing, i) in poke.ingredients" :key="ing.id" class="field">
      <label class="row">食材 {{ i + 1 }} <IngredientIcon :id="ing.id" :name="ing.name" /> {{ ing.name }}</label>
      <select :value="model.ingredientSlots[i] ?? 0" @change="setSlot(i, Number(($event.target as HTMLSelectElement).value))">
        <option v-for="(amt, ai) in ing.amounts" :key="ai" :value="ai">{{ amt }}</option>
      </select>
    </div>
    <div class="field">
      <label>技能等级</label>
      <input v-model.number="model.skillLevel" type="number" min="1" :max="skillMax">
    </div>
  </div>
</template>
