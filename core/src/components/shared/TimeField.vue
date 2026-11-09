<script setup lang="ts">
import { computed } from 'vue'
import { t } from '../../ui/i18n'

defineProps<{ id?: string; disabled?: boolean }>()
const time = defineModel<string>({ required: true })
const twoDigits = (value: number) => String(value).padStart(2, '0')
const hours = Array.from({ length: 24 }, (_, value) => twoDigits(value))
const minutes = Array.from({ length: 60 }, (_, value) => twoDigits(value))
const hour = computed({
  get: () => time.value?.slice(0, 2) || '00',
  set: (value: string) => { time.value = value + ':' + minute.value },
})
const minute = computed({
  get: () => time.value?.slice(3, 5) || '00',
  set: (value: string) => { time.value = hour.value + ':' + value },
})
</script>

<template>
  <div class="time-field">
    <select :id="id" v-model="hour" :disabled="disabled" :aria-label="t('小时')">
      <option v-for="value in hours" :key="value" :value="value">{{ value }}</option>
    </select>
    <span aria-hidden="true">:</span>
    <select v-model="minute" :disabled="disabled" :aria-label="t('分钟')">
      <option v-for="value in minutes" :key="value" :value="value">{{ value }}</option>
    </select>
  </div>
</template>

<style scoped>
.time-field { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; gap: 4px; }
.time-field select { min-width: 0; padding-inline: 6px; }
</style>
