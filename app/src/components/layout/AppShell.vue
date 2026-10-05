<script setup lang="ts">
import { computed, onMounted, shallowRef } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { useBoxStore } from '../../stores/box'
import { usePlanStore } from '../../stores/plans'
import { useRosterStore } from '../../stores/roster'
import { useSettingsStore } from '../../stores/settings'
import SettingsPanel from './SettingsPanel.vue'
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
const title = computed(() => titles[String(route.name)] ?? '宝睡助手')
const open = shallowRef(false)
const settings = useSettingsStore()
const updater = useUpdateStore()

onMounted(async () => {
  void updater.initialize()
  await Promise.all([
    settings.hydrate(),
    useBoxStore().hydrate(),
    useRosterStore().hydrate(),
    usePlanStore().hydrate(),
  ])
})
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <div class="brand">
        <small>CAMP RESEARCH</small>
        <h1>{{ title }}</h1>
      </div>
      <button class="gear" type="button" aria-label="设置" @click="open = true">⚙</button>
    </header>
    <main class="page">
      <RouterView />
    </main>
    <nav class="tabbar">
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
    <SettingsPanel v-if="open" @close="open = false" />
    <UpdateDialog />
  </div>
</template>
