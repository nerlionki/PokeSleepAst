<script setup lang="ts">
import { individualName, t as translateUi } from '../../ui/i18n'
import { computed, ref } from 'vue'
import { calculateSp, defaultSpInput, spInputFromMember } from '../../calc/sp'
import { defaultTune, type MemberDraft } from '../../calc/member'
import { useBoxStore } from '../../stores/box'
import { speciesName } from '../../calc/boxFilter'
import PokePicker from '#platform/PokePicker.vue'
import MemberEditor from '../team/MemberEditor.vue'
import { SP_EDITOR_IGNORE } from '../team/memberEditorFields'
import SpResult from './SpResult.vue'
const box = useBoxStore()
function blank(id?: number): MemberDraft {
  const { ribbonHours, ...input } = defaultSpInput(id)
  return { ...input, tune: { ...defaultTune(input.pokeId), ribbonHours } }
}
const input = ref<MemberDraft>(blank())
const selected = ref('')
const selectedMember = computed(() => box.pokemon.find(member => member.uid === selected.value))
const calculation = computed(() => {
  try { return { result: calculateSp(spInputFromMember(selectedMember.value ?? input.value)), error: '' } }
  catch (error) { return { result: null, error: error instanceof Error ? error.message : '无法计算 SP' } }
})

function choose(id: number) {
  if (id !== input.value.pokeId) input.value = blank(id)
}
</script>
<template>
  <div class="stack form-pane">
    <h3>{{ translateUi("SP 计算") }}</h3>
    <label class="field">
      <span>{{ translateUi("从 Box 导入") }}</span>
      <select v-model="selected">
        <option value="">{{ translateUi("手动设置") }}</option>
        <option v-for="member in box.pokemon" :key="member.uid" :value="member.uid">{{ individualName(member.name, speciesName(member.pokeId)) }} · Lv.{{ member.level }}</option>
      </select>
    </label>
    <div v-if="!selectedMember" class="field">
      <span>{{ translateUi("选择宝可梦") }}</span>
      <PokePicker :model-value="input.pokeId" editor-title="编辑个体" @update:model-value="choose">
        <template #editor>
          <MemberEditor v-model="input" :ignore="SP_EDITOR_IGNORE" />
        </template>
        <template #editorFooter="{ close }">
          <button class="btn" type="button" @click="close">{{ translateUi("完成") }}</button>
        </template>
      </PokePicker>
    </div>
    <SpResult v-if="calculation.result" :result="calculation.result" />
    <p v-if="calculation.error" class="amber" role="alert">{{ translateUi(calculation.error) }}</p>
  </div>
</template>
