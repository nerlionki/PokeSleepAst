<script setup lang="ts">
import { t as translateUi } from '../../ui/i18n'
import { computed } from 'vue'
import { taskNavigationLocked } from '../../composables/taskNavigationLock'
import { useGuideStore } from '../../stores/guide'
import type { GuidePage } from '../../ui/guide'
const props = withDefaults(defineProps<{ page: GuidePage | 'profile'; showTrigger?: boolean }>(), { showTrigger: true })
const guide = useGuideStore()
const profile = computed(() => props.page === 'profile')
function start() {
  if (props.page === 'profile') guide.openOverview()
  else guide.openPage(props.page)
}
</script>
<template>
  <div v-if="showTrigger !== false" class="guide-entry" @touchstart.stop @touchend.stop @touchcancel.stop>
    <button :class="profile ? 'card guide-profile-trigger' : 'btn ghost guide-trigger'" type="button" :disabled="taskNavigationLocked" @click="start">
      <span>{{ profile ? translateUi("重新查看引导") : translateUi("使用引导") }}</span><span v-if="profile" aria-hidden="true">›</span>
    </button>
    <p v-if="guide.error" class="muted guide-error" role="status">{{ translateUi(guide.error) }}</p>
  </div>
</template>
<style scoped>
.guide-entry { flex-shrink: 0; display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
.guide-trigger { min-height: 44px; }
.guide-profile-trigger { display: flex; align-items: center; justify-content: space-between; gap: 16px; width: 100%; min-height: 44px; color: var(--text); font: inherit; text-align: left; }
.guide-profile-trigger > span:last-child { color: var(--muted); }
.guide-error { width: 100%; text-align: left; }
</style>
