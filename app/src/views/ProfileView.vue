<script setup lang="ts">
import UiIconButton from '../../../core/src/components/shared/UiIconButton.vue'
import { t as translateUi } from '../../../core/src/ui/i18n'
import { useRoute, useRouter } from 'vue-router'
import DataSourcePane from '../../../core/src/components/profile/DataSourcePane.vue'
import FeaturesPane from '../../../core/src/components/profile/FeaturesPane.vue'
import BackupPane from '../../../core/src/components/profile/BackupPane.vue'
import AppearancePane from '../../../core/src/components/profile/AppearancePane.vue'
import CreditsPane from '../../../core/src/components/profile/CreditsPane.vue'
import SettingsPanel from '../components/layout/SettingsPanel.vue'
import RecipeLevelsPane from '../../../core/src/components/profile/RecipeLevelsPane.vue'
import UpdateSettings from '../../../core/src/components/update/UpdateSettings.vue'
import GuideEntry from '../../../core/src/components/shared/GuideEntry.vue'
import { useProfilePage } from '../../../core/src/composables/useProfilePage'
import { computed } from 'vue'
import AppLogsPane from '../components/profile/AppLogsPane.vue'

const route = useRoute()
const router = useRouter()
const { tab, userInfo, titles } = useProfilePage(['update'])

const logsOpen = computed(() => route.query.tab === 'logs')
function showLogs(tab: 'home' | 'logs') {
  void router.push({ path: route.path, query: { ...route.query, tab } })
}
function goBack() {
  if (tab.value !== 'recipe-levels') {
    tab.value = 'home'
    return
  }
  const previous = router.options?.history.state.back
  const destination = typeof previous === 'string' ? router.resolve(previous) : null
  if (destination?.path === route.path && destination.query.tab === 'settings') router.back()
  else void router.replace({ path: route.path, query: { ...route.query, tab: 'settings' } })
}
</script>

<template>
  <div class="stack" :class="{ 'form-pane': !logsOpen }">
    <template v-if="logsOpen">
      <div class="profile-subpage-header"><UiIconButton icon="back" :label="translateUi('返回我的')" @click="showLogs('home')" /><h2>{{ translateUi("应用日志") }}</h2></div>
      <AppLogsPane />
    </template>
    <template v-else-if="tab === 'home'">
      <GuideEntry page="profile" />
      <section v-if="userInfo" class="card"><h3>{{ userInfo.name }}</h3></section>
      <button class="card profile-entry" type="button" @click="tab = 'backup'"><span>{{ translateUi("导入 / 导出") }}</span><span aria-hidden="true">›</span></button>
      <button class="card profile-entry" type="button" @click="tab = 'settings'"><span>{{ translateUi("全局设置") }}</span><span aria-hidden="true">›</span></button>
      <button class="card profile-entry" type="button" @click="tab = 'appearance'"><span>{{ translateUi("外观设置") }}</span><span aria-hidden="true">›</span></button>
      <button class="card profile-entry" type="button" @click="tab = 'credits'"><span>鸣谢</span><span aria-hidden="true">›</span></button>
      <button class="card profile-entry" type="button" @click="tab = 'update'"><span>{{ translateUi("检查更新") }}</span><span aria-hidden="true">›</span></button>
      <button class="card profile-entry" type="button" @click="tab = 'features'"><span>{{ translateUi("功能开关") }}</span><span aria-hidden="true">›</span></button>
      <DataSourcePane />
      <button class="card profile-entry" type="button" @click="showLogs('logs')"><span>{{ translateUi("应用日志") }}</span><span aria-hidden="true">›</span></button>
    </template>
    <template v-else>
      <div class="profile-subpage-header" :class="{ 'settings-subpage-header': tab === 'settings' }"><UiIconButton icon="back" :label="translateUi(tab === 'recipe-levels' ? '返回' : '返回我的')" @click="goBack" /><h2>{{ translateUi(titles[tab]) }}</h2></div>
      <FeaturesPane v-if="tab === 'features'" />
      <BackupPane v-else-if="tab === 'backup'" />
      <AppearancePane v-else-if="tab === 'appearance'" />
      <SettingsPanel v-else-if="tab === 'settings'" embedded @close="tab = 'home'" @recipes="tab = 'recipe-levels'" />
      <RecipeLevelsPane v-else-if="tab === 'recipe-levels'" />
      <CreditsPane v-else-if="tab === 'credits'" />
      <section v-else-if="tab === 'update'" class="card"><UpdateSettings /></section>
    </template>
  </div>
</template>

<style scoped>
.profile-entry { display: flex; align-items: center; justify-content: space-between; gap: 16px; width: 100%; color: var(--text); font: inherit; text-align: left; }
.profile-entry > span:last-child { color: var(--muted); }
</style>
