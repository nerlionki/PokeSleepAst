<script setup lang="ts">
defineProps<{ open: boolean; label: string; requestCancel: () => void }>()
const emit = defineEmits<{ focus: [] }>()
</script>

<template>
  <Teleport to="body">
    <div v-if="open" v-back="requestCancel" class="overlay progress-dialog" role="dialog" aria-modal="true" :aria-label="label"
      @keydown.esc.prevent="requestCancel" @keydown.tab.prevent="emit('focus')" @touchmove.self.prevent>
      <slot />
    </div>
  </Teleport>
</template>

<style>
.progress-dialog { z-index: 10000; display: flex; align-items: center; justify-content: center; padding: 20px; }
</style>
