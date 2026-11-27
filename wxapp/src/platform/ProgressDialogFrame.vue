<script setup lang="ts">
import OverlayPortal from './OverlayPortal.vue'

defineProps<{ open: boolean; label: string; requestCancel: () => void }>()
defineEmits<{ focus: [] }>()
</script>

<template>
  <OverlayPortal v-if="open">
    <view v-back="requestCancel" class="overlay progress-dialog" role="dialog" aria-modal="true" :aria-label="label"
      @touchstart.stop @touchend.stop @touchcancel.stop @touchmove.self.prevent>
      <slot />
    </view>
  </OverlayPortal>
</template>

<style>
.progress-dialog { z-index: 10000; display: flex; align-items: center; justify-content: center; padding: 20px; }
</style>
