<script setup lang="ts">
import Dialog from '#platform/Dialog.vue'

defineProps<{ title: string }>()
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <Dialog :title="title" variant="drawer" @close="emit('close')">
    <slot />
  </Dialog>
</template>
