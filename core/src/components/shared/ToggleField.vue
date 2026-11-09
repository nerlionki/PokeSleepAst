<script setup lang="ts">
import { t as translateUi } from '../../ui/i18n'

withDefaults(defineProps<{ label: string, disabled?: boolean }>(), { disabled: false })
const model = defineModel<boolean>({ required: true })
</script>

<template>
  <label class="row"><input v-model="model" type="checkbox" :disabled="disabled"><span>{{ translateUi(label) }}</span></label>
</template>
