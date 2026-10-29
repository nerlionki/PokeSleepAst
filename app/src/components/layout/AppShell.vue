<script setup lang="ts">
import { useFeaturesStore } from '../../../../core/src/stores/features'
import { taskNavigationLocked } from '../../../../core/src/composables/taskNavigationLock'
import { usePageTab } from '../../../../core/src/composables/usePageTab'
import { computed, onMounted, watchEffect } from 'vue'
import { useAppearanceStore } from '../../../../core/src/stores/appearance'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { useBoxStore } from '../../stores/box'
import { usePlanStore } from '../../stores/plans'
import { useRosterStore } from '../../stores/roster'
import { useSettingsStore } from '../../stores/settings'
import UpdateDialog from '../update/UpdateDialog.vue'
import { useUpdateStore } from '../../stores/update'

const titles: Record<string, string> = {
  pokemon: '宝可梦',
  plan: '规划',
  team: '配队',
  data: '生产资料',
  profile: '个人中心',
}

const route = useRoute()
const pokemonTab = usePageTab(['dex', 'box', 'wall'] as const, 'dex')
const title = computed(() => titles[String(route.name)] ?? '宝睡助手')
const settings = useSettingsStore()
const updater = useUpdateStore()
const appearance = useAppearanceStore()
watchEffect(() => {
  for (const [key, value] of Object.entries(appearance.variables)) document.documentElement.style.setProperty(key, value)
})

onMounted(async () => {
  void updater.initialize()
  await Promise.all([
    settings.hydrate(),
    useFeaturesStore().hydrate(),
    appearance.hydrate(),
    useBoxStore().hydrate(),
    useRosterStore().hydrate(),
    usePlanStore().hydrate(),
  ])
})
</script>

<template>
  <div class="app-shell" :class="{ 'dex-shell': route.name === 'pokemon' && pokemonTab === 'dex' }">
    <header class="topbar">
      <div class="brand">
        <small>CAMP RESEARCH</small>
        <h1>{{ title }}</h1>
      </div>
    </header>
    <main class="page">
      <RouterView />
    </main>
    <nav class="tabbar" :inert="taskNavigationLocked" :aria-disabled="taskNavigationLocked">
      <RouterLink :to="{ name: 'pokemon' }">
        <span class="tab-ico" aria-hidden="true">●</span>
        宝可梦
      </RouterLink>
      <RouterLink :to="{ name: 'plan' }">
        <span class="tab-ico" aria-hidden="true">▤</span>
        规划
      </RouterLink>
      <RouterLink :to="{ name: 'team' }">
        <span class="tab-ico" aria-hidden="true">☰</span>
        配队
      </RouterLink>
      <RouterLink :to="{ name: 'data' }">
        <span class="tab-ico" aria-hidden="true">▦</span>
        资料
      </RouterLink>
      <RouterLink :to="{ name: 'profile' }">
        <span class="tab-ico" aria-hidden="true">○</span>
        我的
      </RouterLink>
    </nav>
    <UpdateDialog />
  </div>
</template>
