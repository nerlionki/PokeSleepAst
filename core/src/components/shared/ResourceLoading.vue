<script setup lang="ts">
import { t as translateUi } from '../../ui/i18n'
import { computed, onScopeDispose, shallowRef } from 'vue'
import { readClientDefaults } from '../../data/client-defaults.reader.resource'
import { loadJson } from '../../storage'
import { loadingProgress, subscribeLoadingProgress } from '../../resources/loadingProgress'
const themeStyle = shallowRef<Record<string, string>>({})
const loadingColors = ['ink', 'line', 'text', 'muted', 'sage'] as const
void loadJson<{ theme?: string; colors?: Record<string, unknown> } | null>('appearance', null).then(saved => {
  if (!saved) return
  const themes = readClientDefaults().modules.ui_appearance.themes
  const palette = (themes.find(theme => theme.id === saved.theme) ?? themes[0]).colors
  themeStyle.value = Object.fromEntries(loadingColors.map(key => {
    const custom = saved.colors?.[key]
    const value = typeof custom === 'string' && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(custom.trim()) ? custom.trim() : palette[key]
    return ['--' + key, value]
  }))
}).catch(() => { /* The page tokens provide the default loading appearance. */ })
const progress = shallowRef(loadingProgress())
onScopeDispose(subscribeLoadingProgress(value => { progress.value = value }))
const right = computed(() => `rotate(${-180 + Math.min(progress.value.percent, 50) * 3.6}deg)`)
const left = computed(() => `rotate(${Math.max(progress.value.percent - 50, 0) * 3.6}deg)`)
</script>
<template>
  <div class="resource-loading" :style="themeStyle" role="status" aria-live="polite">
    <div class="resource-loading-content">
      <div class="resource-loading-ring" role="progressbar" :aria-valuenow="progress.percent" aria-valuemin="0" aria-valuemax="100" :aria-label="translateUi('资料加载进度')">
        <div class="resource-ring-half resource-ring-right"><div class="resource-ring-fill" :style="{ transform: right }" /></div>
        <div class="resource-ring-half resource-ring-left"><div class="resource-ring-fill" :style="{ transform: left }" /></div>
        <div class="resource-ring-center"><span class="resource-ring-value">{{ progress.percent }}%</span></div>
      </div>
      <span class="resource-loading-label">{{ translateUi(progress.label) }}</span>
    </div>
  </div>
</template>
<style scoped>
.resource-loading { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; background: var(--ink); color: var(--text); font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
.resource-loading-content { display: flex; flex-direction: column; align-items: center; gap: 24px; padding: 24px; text-align: center; }
.resource-loading-ring { position: relative; width: 96px; height: 96px; overflow: hidden; border-radius: 50%; background: var(--line); }
.resource-ring-half { position: absolute; top: 0; width: 48px; height: 96px; overflow: hidden; }
.resource-ring-right { right: 0; }
.resource-ring-left { left: 0; }
.resource-ring-fill { position: absolute; top: 0; width: 96px; height: 96px; background: linear-gradient(to right, transparent 50%, var(--sage) 50%); }
.resource-ring-right .resource-ring-fill { right: 0; }
.resource-ring-left .resource-ring-fill { left: 0; }
.resource-ring-center { position: absolute; inset: 6px; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: var(--ink); }
.resource-ring-value { font-size: 22px; font-weight: 600; font-variant-numeric: tabular-nums; }
.resource-loading-label { font-size: 15px; line-height: 1.6; color: var(--muted); }
</style>
