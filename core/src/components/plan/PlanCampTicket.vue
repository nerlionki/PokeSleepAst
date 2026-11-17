<script setup lang="ts">
import { computed } from 'vue'
import { t } from '../../ui/i18n'
import { useSettingsStore } from '../../stores/settings'
import type { CampTicketMode } from '../../composables/usePlanCampTicket'

const mode = defineModel<CampTicketMode>({ required: true })
defineProps<{ disabled?: boolean }>()
const settings = useSettingsStore()
const checked = computed({
  get: () => mode.value === 'global' ? settings.settings.goodCamp : mode.value === 'on',
  set: (value: boolean) => { mode.value = value ? 'on' : 'off' }
})
</script>

<template>
  <div class="row">
    <label class="row">
      <input v-model="checked" type="checkbox" role="switch" :disabled="disabled" />
      <span>{{ t('露营券 +1（只加第一觉）') }}</span>
    </label>
    <span v-if="mode === 'global'" class="muted">{{ t('跟随全局设置') }}</span>
    <button v-else type="button" class="btn ghost" :disabled="disabled" @click="mode = 'global'">
      {{ t('跟随全局设置') }}
    </button>
  </div>
</template>
