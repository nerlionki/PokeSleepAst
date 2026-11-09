<script setup lang="ts">
import { t as translateUi } from '../ui/i18n'
import clientDefaults from '../data/client-defaults.resource'
import { cloneData } from '../calc/dataClone'

import { shallowRef } from 'vue'
import { canCheckAppUpdate } from '#platform/profile'
import { usePageTab } from '../composables/usePageTab'
import DataSourcePane from '../components/profile/DataSourcePane.vue'
import FeaturesPane from '../components/profile/FeaturesPane.vue'
import BackupPane from '../components/profile/BackupPane.vue'
import AppearancePane from '../components/profile/AppearancePane.vue'
import CreditsPane from '../components/profile/CreditsPane.vue'
import SettingsPanel from '../components/layout/SettingsPanel.vue'
import UpdateSettings from '../components/update/UpdateSettings.vue'
import GuideEntry from '../components/shared/GuideEntry.vue'
const views_ProfileView_config_clientDefaults = clientDefaults.modules.views_ProfileView

const tab = usePageTab(['home', 'backup', 'settings', 'appearance', 'credits', 'update', 'features'] as const, 'home')
const userInfo = shallowRef<{ name: string; avatar?: string } | null>((views_ProfileView_config_clientDefaults["userInfoInitial"] as unknown as { name: string; avatar?: string } | null))
const titles = { ...cloneData(views_ProfileView_config_clientDefaults["titles"]), features: '功能开关' }
</script>
<template>
  <div class="stack">
    <template v-if="tab === 'home'">
      <GuideEntry page="profile" />
      <section v-if="userInfo" class="card"><h3>{{ userInfo.name }}</h3></section>
      <button class="card profile-entry" type="button" @click="tab = 'backup'"><span>{{ translateUi("导入 / 导出") }}</span><span aria-hidden="true">›</span></button>
      <button class="card profile-entry" type="button" @click="tab = 'settings'"><span>{{ translateUi("全局设置") }}</span><span aria-hidden="true">›</span></button>
      <button class="card profile-entry" type="button" @click="tab = 'appearance'"><span>{{ translateUi("外观设置") }}</span><span aria-hidden="true">›</span></button>
      <button class="card profile-entry" type="button" @click="tab = 'credits'"><span>鸣谢</span><span aria-hidden="true">›</span></button>
      <button v-if="canCheckAppUpdate" class="card profile-entry" type="button" @click="tab = 'update'"><span>{{ translateUi("检查更新") }}</span><span aria-hidden="true">›</span></button>
      <button class="card profile-entry" type="button" @click="tab = 'features'"><span>{{ translateUi("功能开关") }}</span><span aria-hidden="true">›</span></button>
      <DataSourcePane />
      <slot name="app-tools" />
    </template>
    <template v-else>
      <div class="row"><button class="btn ghost" type="button" @click="tab = 'home'">{{ translateUi("返回我的") }}</button><h2>{{ translateUi(titles[tab]) }}</h2></div>
      <FeaturesPane v-if="tab === 'features'" />
      <BackupPane v-else-if="tab === 'backup'" />
      <AppearancePane v-else-if="tab === 'appearance'" />
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
