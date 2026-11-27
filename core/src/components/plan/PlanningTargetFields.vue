<script setup lang="ts">
import { useId } from 'vue'
import PokePicker from '#platform/PokePicker.vue'
import { BABY_POKEMON_NAMES } from '../../calc/babyEfficiency'
import type { CompletionSelectionMode } from '../../calc/completionEfficiency'
import type { SleepStyleRow } from '../../calc/data'
import { raeSleepStyleId, type SleepStyleRef } from '../../calc/sleepStyleIdentity'
import { sleepStyleText, t } from '../../ui/i18n'

defineProps<{
  styleTarget: boolean
  allowedIds: readonly number[]
  faces: readonly SleepStyleRow[]
  showStyle: boolean
  emptyStyleOption?: boolean
  disabled?: boolean
}>()
const selectionMode = defineModel<CompletionSelectionMode>('selectionMode', { required: true })
const pokeId = defineModel<number>('pokeId', { required: true })
const styleId = defineModel<SleepStyleRef | undefined>('styleId', { required: true })
const fieldId = useId()
</script>

<template>
  <div class="stack">
    <template v-if="styleTarget">
      <div class="field">
        <label :for="fieldId + '-scope'">{{ t('睡姿选择范围') }}</label>
        <select :id="fieldId + '-scope'" v-model="selectionMode" :disabled="disabled">
          <option value="sleepdex">{{ t('根据睡姿图鉴 · 仅未收集') }}</option>
          <option value="free">{{ t('自由选择') }}</option>
        </select>
      </div>
      <p v-if="!allowedIds.length" class="muted">{{ t('暂无可选择的睡姿。可切换为自由选择，或在睡姿图鉴中取消勾选尚未收集的睡姿。') }}</p>
    </template>
    <div v-if="allowedIds.length || pokeId" class="field">
      <label>{{ t(styleTarget ? '目标宝可梦' : '目标一阶段宝可梦') }}</label>
      <PokePicker v-if="!disabled" v-model="pokeId" :allowed-ids="allowedIds"
        :name-overrides="styleTarget ? undefined : BABY_POKEMON_NAMES" />
    </div>
    <div v-if="styleTarget && showStyle" class="field">
      <label :for="fieldId + '-style'">{{ t('具体睡姿') }}</label>
      <select :id="fieldId + '-style'" v-model="styleId" :disabled="disabled">
        <option v-if="emptyStyleOption" value="">{{ t('请选择具体睡姿') }}</option>
        <option v-for="face in faces" :key="raeSleepStyleId(face)" :value="raeSleepStyleId(face)">
          {{ face.stars }}★ · {{ sleepStyleText(face) }}
        </option>
      </select>
    </div>
  </div>
</template>
