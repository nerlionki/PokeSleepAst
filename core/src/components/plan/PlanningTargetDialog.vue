<script setup lang="ts">
import Dialog from '#platform/Dialog.vue'
import { t } from '../../ui/i18n'

defineProps<{ title: string; ready: boolean }>()
const emit = defineEmits<{ close: []; save: [] }>()
</script>

<template>
  <Dialog :title="title" @close="emit('close')">
    <slot />
    <template #footer>
      <button type="button" class="btn sage" :disabled="!ready" @click="emit('save')">{{ t('完成') }}</button>
    </template>
  </Dialog>
</template>
