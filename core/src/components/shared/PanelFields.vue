<script setup lang="ts">
import { gameText, t as translateUi } from '../../ui/i18n'


import { INPUT_RANGES } from '../../calc/inputRanges'
const INPUT_LIMITS = INPUT_RANGES.PanelFields

import FormField from './FormField.vue'
import ToggleField from './ToggleField.vue'
import { computed } from 'vue'
import { NATURES, POKEDEX, SUBSKILLS, pokeById } from '../../calc/data'
import { POKEMON_LEVEL_MAX } from '../../calc/xp'
import { skillMaxFor } from '../../calc/mainSkills'
import { SUBSKILL_GATES } from '../../calc/member'
import type { ProduceInput } from '../../types'
import IngredientIcon from './IngredientIcon.vue'
import PokePicker from './PokePicker.vue'

const natureMinted = computed({ get: () => model.value.natureMinted === true, set: (natureMinted: boolean) => patch({ natureMinted }) })
const model = defineModel<ProduceInput>({ required: true })

const poke = computed(() => pokeById(model.value.pokeId) ?? POKEDEX[0]!)
const skillMax = computed(() => skillMaxFor(poke.value.mainSkill))

function patch(value: Partial<ProduceInput>) {
  model.value = { ...model.value, ...value }
}
const pokeId = computed({ get: () => model.value.pokeId, set: (pokeId: number) => patch({ pokeId }) })
const level = computed({ get: () => model.value.level, set: (level: number) => patch({ level }) })
const nature = computed({ get: () => model.value.nature, set: (nature: string) => patch({ nature }) })
const skillLevel = computed({ get: () => model.value.skillLevel, set: (skillLevel: number) => patch({ skillLevel }) })

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
      <label>{{ translateUi("宝可梦") }}</label>
      <PokePicker v-model="pokeId" />
    </div>
    <FormField v-slot="{ id }" :label="translateUi('等级')"><input :id="id" v-model.number="level" type="number" :min="INPUT_LIMITS.level.min" :max="POKEMON_LEVEL_MAX"></FormField>
    <FormField v-slot="{ id }" :label="translateUi('性格')"><select :id="id" v-model="nature">
        <option v-for="n in NATURES" :key="n.name" :value="n.name">{{ gameText(n.name) }}</option>
      </select></FormField>
    <ToggleField v-model="natureMinted" :label="translateUi('已使用净白薄荷（性格无加减成）')" />
    <div v-for="i in SUBSKILL_GATES.length" :key="i" class="field">
      <label>{{ translateUi("副技能") }} {{ i }}</label>
      <select :value="model.subskills[i - 1] ?? ''" @change="setSub(i - 1, ($event.target as HTMLSelectElement).value)">
        <option value="">{{ translateUi("（空）") }}</option>
        <option v-for="s in SUBSKILLS" :key="s.id" :value="s.id">{{ gameText(s.name) }}</option>
      </select>
    </div>
    <div v-for="(ing, i) in poke.ingredients" :key="ing.id" class="field">
      <label class="row">{{ translateUi("食材") }} {{ i + 1 }} <IngredientIcon :id="ing.id" :name="ing.name" /> {{ gameText(ing.name) }}</label>
      <select :value="model.ingredientSlots[i] ?? 0" @change="setSlot(i, Number(($event.target as HTMLSelectElement).value))">
        <option v-for="(amt, ai) in ing.amounts" :key="ai" :value="ai">{{ amt }}</option>
      </select>
    </div>
    <FormField v-slot="{ id }" :label="translateUi('技能等级')"><input :id="id" v-model.number="skillLevel" type="number" :min="INPUT_LIMITS.skillLevel.min" :max="skillMax"></FormField>
  </div>
</template>
