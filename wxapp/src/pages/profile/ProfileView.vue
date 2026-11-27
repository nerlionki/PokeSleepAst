<script setup lang="ts">
import UiIconButton from '../../generated/components/shared/UiIconButton.vue'
import { t as translateUi } from '../../../../core/src/ui/i18n'
import { useRoute, useRouter } from 'vue-router'
import DataSourcePane from '../../generated/components/profile/DataSourcePane.vue'
import FeaturesPane from '../../generated/components/profile/FeaturesPane.vue'
import BackupPane from '../../generated/components/profile/BackupPane.vue'
import AppearancePane from '../../generated/components/profile/AppearancePane.vue'
import CreditsPane from '../../generated/components/profile/CreditsPane.vue'
import SettingsPanel from './SettingsPanel.vue'
import RecipeLevelsPane from '../../generated/components/profile/RecipeLevelsPane.vue'
import GuideEntry from '../../generated/components/shared/GuideEntry.vue'
import { useProfilePage } from '../../../../core/src/composables/useProfilePage'
import ShareEntry from '../../components/ShareEntry.vue'

const route = useRoute()
const router = useRouter()
const { tab, userInfo, titles } = useProfilePage()

function goBack() {
  if (tab.value !== 'recipe-levels') {
    tab.value = 'home'
    return
  }
  void router.replace({ path: route.path, query: { ...route.query, tab: 'settings' } })
}
</script>

<template>
  <view class="stack form-pane profile-page">
    <template v-if="tab === 'home'">
      <GuideEntry page="profile" />
      <section v-if="userInfo" class="card"><h3>{{ userInfo.name }}</h3></section>
      <button class="card profile-entry" type="button" @click="tab = 'backup'"><span>{{ translateUi("导入 / 导出") }}</span><span aria-hidden="true">›</span></button>
      <button class="card profile-entry" type="button" @click="tab = 'settings'"><span>{{ translateUi("全局设置") }}</span><span aria-hidden="true">›</span></button>
      <button class="card profile-entry" type="button" @click="tab = 'appearance'"><span>{{ translateUi("外观设置") }}</span><span aria-hidden="true">›</span></button>
      <button class="card profile-entry" type="button" @click="tab = 'credits'"><span>鸣谢</span><span aria-hidden="true">›</span></button>
      <button class="card profile-entry" type="button" @click="tab = 'features'"><span>{{ translateUi("功能开关") }}</span><span aria-hidden="true">›</span></button>
      <DataSourcePane />
      <ShareEntry />
    </template>
    <template v-else>
      <div class="profile-subpage-header" :class="{ 'settings-subpage-header': tab === 'settings' }"><UiIconButton icon="back" :label="translateUi(tab === 'recipe-levels' ? '返回' : '返回我的')" @click="goBack" /><h2>{{ translateUi(titles[tab]) }}</h2></div>
      <FeaturesPane v-if="tab === 'features'" />
      <BackupPane v-else-if="tab === 'backup'" />
      <AppearancePane v-else-if="tab === 'appearance'" />
      <SettingsPanel v-else-if="tab === 'settings'" embedded @close="tab = 'home'" @recipes="tab = 'recipe-levels'" />
      <RecipeLevelsPane v-else-if="tab === 'recipe-levels'" />
      <CreditsPane v-else-if="tab === 'credits'" />
    </template>
  </view>
</template>

<style>
.profile-page .profile-entry { display: flex; align-items: center; justify-content: space-between; gap: 16px; width: 100%; color: var(--text); font: inherit; text-align: left; }
.profile-page .profile-entry > span:last-child { color: var(--muted); }
</style>
