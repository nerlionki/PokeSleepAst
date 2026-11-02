<script setup lang="ts">
import { computed, onScopeDispose, shallowRef } from 'vue'
import { loadingProgress, subscribeLoadingProgress } from '../../resources/loadingProgress'
const progress = shallowRef(loadingProgress())
onScopeDispose(subscribeLoadingProgress(value => { progress.value = value }))
const right = computed(() => `rotate(${-180 + Math.min(progress.value.percent, 50) * 3.6}deg)`)
const left = computed(() => `rotate(${Math.max(progress.value.percent - 50, 0) * 3.6}deg)`)
</script>
<template>
  <div class="resource-loading" role="status" aria-live="polite">
    <div class="resource-loading-content">
      <div class="resource-loading-ring" role="progressbar" :aria-valuenow="progress.percent" aria-valuemin="0" aria-valuemax="100" aria-label="资料加载进度">
        <div class="resource-ring-half resource-ring-right"><div class="resource-ring-fill" :style="{ transform: right }" /></div>
        <div class="resource-ring-half resource-ring-left"><div class="resource-ring-fill" :style="{ transform: left }" /></div>
        <div class="resource-ring-center"><span class="resource-ring-value">{{ progress.percent }}%</span></div>
      </div>
      <span class="resource-loading-label">{{ progress.label }}</span>
    </div>
  </div>
</template>
<style scoped>
.resource-loading { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; background: #081018; color: #edf3f7; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
.resource-loading-content { display: flex; flex-direction: column; align-items: center; gap: 24px; padding: 24px; text-align: center; }
.resource-loading-ring { position: relative; width: 96px; height: 96px; overflow: hidden; border-radius: 50%; background: #27384a; }
.resource-ring-half { position: absolute; top: 0; width: 48px; height: 96px; overflow: hidden; }
.resource-ring-right { right: 0; }
.resource-ring-left { left: 0; }
.resource-ring-fill { position: absolute; top: 0; width: 96px; height: 96px; background: linear-gradient(to right, transparent 50%, #7fcec0 50%); }
.resource-ring-right .resource-ring-fill { right: 0; }
.resource-ring-left .resource-ring-fill { left: 0; }
.resource-ring-center { position: absolute; inset: 6px; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: #081018; }
.resource-ring-value { font-size: 22px; font-weight: 600; font-variant-numeric: tabular-nums; }
.resource-loading-label { font-size: 15px; line-height: 1.6; color: #b5c1cf; }
</style>
