<script setup lang="ts">
import { shallowRef } from 'vue'
import { canCheckAppUpdate } from '#platform/profile'
import { usePageTab } from '../composables/usePageTab'
import BackupPane from '../components/profile/BackupPane.vue'
import CreditsPane from '../components/profile/CreditsPane.vue'
import SettingsPanel from '../components/layout/SettingsPanel.vue'
import UpdateSettings from '../components/update/UpdateSettings.vue'
const tab = usePageTab(['home', 'backup', 'settings', 'credits', 'update'] as const, 'home')
const userInfo = shallowRef<{ name: string; avatar?: string } | null>(null)
const titles = { home: '我的', backup: '导入 / 导出', settings: '全局设置', credits: '鸣谢', update: '检查更新' }
</script>
<template>
  <div class="stack">
    <template v-if="tab === 'home'">
      <section v-if="userInfo" class="card"><h3>{{ userInfo.name }}</h3></section>
      <button class="card profile-entry" type="button" @click="tab = 'backup'"><span>导入 / 导出</span><span aria-hidden="true">›</span></button>
      <button class="card profile-entry" type="button" @click="tab = 'settings'"><span>全局设置</span><span aria-hidden="true">›</span></button>
      <button class="card profile-entry" type="button" @click="tab = 'credits'"><span>鸣谢</span><span aria-hidden="true">›</span></button>
      <button v-if="canCheckAppUpdate" class="card profile-entry" type="button" @click="tab = 'update'"><span>检查更新</span><span aria-hidden="true">›</span></button>
    </template>
    <template v-else>
      <div class="row"><button class="btn ghost" type="button" @click="tab = 'home'">返回我的</button><h2>{{ titles[tab] }}</h2></div>
      <BackupPane v-if="tab === 'backup'" />
      <SettingsPanel v-else-if="tab === 'settings'" embedded @close="tab = 'home'" />
      <CreditsPane v-else-if="tab === 'credits'" />
      <section v-else-if="tab === 'update' && canCheckAppUpdate" class="card"><UpdateSettings /></section>
    </template>
  </div>
</template>
<style scoped>
.profile-entry { display: flex; align-items: center; justify-content: space-between; gap: 16px; width: 100%; color: var(--text); font: inherit; text-align: left; }
.profile-entry > span:last-child { color: var(--muted); }
</style>
