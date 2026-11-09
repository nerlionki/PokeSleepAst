<script setup lang="ts">
import { t as translateUi } from '../../ui/i18n'
import { computed, ref } from 'vue'
import { calculateSp, defaultSpInput, spInputFromMember } from '../../calc/sp'
import { defaultTune, type MemberDraft } from '../../calc/member'
import { cloneData } from '../../calc/dataClone'
import { useBoxStore } from '../../stores/box'
import { boxLabel } from '../../calc/boxFilter'
import PokePicker from '../shared/PokePicker.vue'
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
const calculation = computed(() => {
  try { return { result: calculateSp(spInputFromMember(input.value)), error: '' } }
  catch (error) { return { result: null, error: error instanceof Error ? error.message : '无法计算 SP' } }
})
function choose(id: number) { selected.value = ''; input.value = blank(id) }
function load() {
  const member = box.pokemon.find(item => item.uid === selected.value)
  if (member) input.value = { ...cloneData(member), tune: { ...defaultTune(), ...cloneData(member.tune ?? {}) } }
  else input.value = blank(input.value.pokeId)
}
</script>
<template>
  <div class="stack">
    <h3>{{ translateUi("SP 计算") }}</h3>
    <p class="muted">{{ translateUi("可自由编辑个体，也可从 Box 载入后继续编辑，不会修改 Box 中的原个体。SP 不计营地、活动或队友加成。") }}</p>
    <button class="btn ghost" type="button" @click="choose(input.pokeId)">{{ translateUi("新建个体") }}</button>
    <label class="field"><span>{{ translateUi("从 Box 载入副本") }}</span><select v-model="selected" @change="load"><option value="">{{ translateUi("手动设置") }}</option><option v-for="member in box.pokemon" :key="member.uid" :value="member.uid">{{ boxLabel(member) }} · Lv.{{ member.level }}</option></select></label>
    <PokePicker :model-value="input.pokeId" @update:model-value="choose" />
    <SpResult v-if="calculation.result" :result="calculation.result" />
    <p v-if="calculation.error" class="amber" role="alert">{{ translateUi(calculation.error) }}</p>
    <MemberEditor v-model="input" :ignore="SP_EDITOR_IGNORE" />
  </div>
</template>
