<script setup lang="ts">
import { t as translateUi } from '../../ui/i18n'
import { INPUT_RANGES } from '../../calc/inputRanges'
import { CANDY_PRESETS as presets, evolutionLevels, type CandyRow } from '../../calc/candyPlan'
import FormField from '../shared/FormField.vue'

const INPUT_LIMITS = INPUT_RANGES.CandyPane
defineProps<{ row: CandyRow; stock: number }>()
const emit = defineEmits<{ stock: [value: number] }>()

function setRemaining(row: CandyRow, raw: string) {
  row.remaining = raw === '' ? null : Math.max(0, Math.floor(Number(raw)) || 0)
}
</script>

<template>
  <div class="stack">
    <div class="row">
      <FormField v-slot="{ id }" :label="translateUi('当前糖果')"><input :id="id" :value="stock" type="number" :min="INPUT_LIMITS.stockOf_row_pokeId.min" @change="emit('stock', Number(($event.target as HTMLInputElement).value))"></FormField>
      <FormField v-slot="{ id }" :label="translateUi('输入方式')"><select :id="id" v-model="row.method">
          <option value="target">{{ translateUi("目标等级") }}</option>
          <option value="manual">{{ translateUi("指定糖果") }}</option>
        </select></FormField>
    </div>
    <div class="row">
      <FormField v-slot="{ id }" :label="translateUi('当前等级')"><input :id="id" v-model.number="row.start" type="number" :min="INPUT_LIMITS.row_start.min" :max="INPUT_LIMITS.row_start.max"></FormField>
      <div v-if="row.method === 'target'" class="field">
        <label>{{ translateUi("目标等级") }}</label>
        <input v-model.number="row.target" type="number" :min="INPUT_LIMITS.row_target.min" :max="INPUT_LIMITS.row_target.max">
      </div>
      <div v-else class="field">
        <label>{{ translateUi("使用糖果") }}</label>
        <input v-model.number="row.use" type="number" :min="INPUT_LIMITS.row_use.min" :disabled="row.useAll">
      </div>
    </div>
    <div v-if="row.method === 'target'" class="picker-opts">
      <button v-for="lv in presets" :key="lv" type="button" :class="{ on: row.target === lv }" @click="row.target = lv">{{ lv }}</button>
      <button
        v-for="lv in evolutionLevels(row.pokeId)"
        :key="'e' + lv"
        type="button"
        :class="{ on: row.target === lv }"
        @click="row.target = lv"
      >{{ translateUi("进化") }} {{ lv }}</button>
    </div>
    <label v-else class="row"><input v-model="row.useAll" type="checkbox"> {{ translateUi("用光当前剩余糖果") }}</label>
    <div class="row">
      <FormField v-slot="{ id }" :label="translateUi('经验修正')"><select :id="id" v-model="row.nature">
          <option value="flat">{{ translateUi("无修正") }}</option>
          <option value="up">+EXP</option>
          <option value="down">−EXP</option>
        </select></FormField>
      <FormField v-slot="{ id }" :label="translateUi('升级还需 EXP')"><input :id="id"
          :value="row.remaining ?? ''"
          type="number"
          :min="INPUT_LIMITS.row_remaining.min"
          :placeholder="translateUi('留空＝刚到本级')"
          @change="setRemaining(row, ($event.target as HTMLInputElement).value)"
        ></FormField>
    </div>
  </div>
</template>
