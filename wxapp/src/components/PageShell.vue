<script setup lang="ts">
import { t as translateUi, language, t } from '../../../core/src/ui/i18n'
import GuideTour from '../generated/components/shared/GuideTour.vue'
import { computed, onMounted, shallowRef, watch } from 'vue'
import Taro, { useDidShow } from '@tarojs/taro'
import { taskNavigationLocked } from '../../../core/src/composables/taskNavigationLock'
import { hydrate } from '../platform/hydrate'
import { isPrivateSharePage, isSinglePageMode } from '../platform/share'
import { usePageTab } from '../../../core/src/composables/usePageTab'
import { activatePage, route } from '../platform/router'
import { useAppearanceStore } from '../../../core/src/stores/appearance'
import { luminance } from '../../../core/src/ui/appearance'
const props = defineProps<{ page: string }>()
const pokemonTab = usePageTab(['dex', 'box', 'wall'] as const, 'dex')
const appearance = useAppearanceStore()
function applyBars() {
  if (route.name !== props.page) return
  const p = appearance.palette
  void Taro.setNavigationBarColor({ backgroundColor: p.ink, frontColor: luminance(p.ink) > 0.179 ? '#000000' : '#ffffff' }).catch(() => {})
  void Taro.setTabBarStyle({ backgroundColor: p['ink-2'], color: p.muted, selectedColor: p.sage, borderStyle: luminance(p.ink) > 0.179 ? 'white' : 'black' }).catch(() => {})
  void Taro.setBackgroundColor({ backgroundColor: p.ink }).catch(() => {})
}
watch(() => appearance.palette, applyBars, { deep: true })
function applyLanguage() {
  if (route.name !== props.page) return
  void Taro.setNavigationBarTitle({ title: t('宝睡助手') }).catch(() => {})
  for (const [index, label] of ['宝可梦', '规划', '配队', '资料', '我的'].entries()) {
    void Taro.setTabBarItem({ index, text: t(label) }).catch(() => {})
  }
}
watch(language, applyLanguage)
const ready = shallowRef(false), error = shallowRef('')
const singlePage = shallowRef(isSinglePageMode())
const privatePreview = computed(() => singlePage.value && isPrivateSharePage(props.page))
function refreshShareMode() { singlePage.value = isSinglePageMode() }
function active() {
  if (taskNavigationLocked.value && route.name !== props.page) {
    void Taro.switchTab({ url: '/pages/' + route.name + '/index' })
    return
  }
  activatePage(props.page)
}
async function load() { try { await hydrate(); applyLanguage(); ready.value = true; error.value = '' } catch (cause) { error.value = cause instanceof Error ? cause.message : '本机数据无法加载，请重试' } }
onMounted(() => { active(); void load(); refreshShareMode() })
useDidShow(() => { active(); applyBars(); applyLanguage(); refreshShareMode() })
</script>
<template>
  <view class="appearance-root" :class="{ 'dex-page-shell': page === 'pokemon' && pokemonTab === 'dex', 'fixed-tabs-shell': page === 'plan' || page === 'data' || page === 'team' }" :style="appearance.variables">
    <view v-if="error" class="card stack"><text>{{ translateUi(error) }}</text><button class="btn" @tap="load">{{ translateUi("重试") }}</button></view>
    <view v-else-if="!ready" class="muted">{{ translateUi("正在加载本机数据…") }}</view>
    <view v-else-if="privatePreview" class="page">
      <view class="card stack">
        <text class="muted">{{ translateUi("朋友圈单页预览不会带上本机 Box、队伍或备份。进入小程序后可使用完整功能。") }}</text>
      </view>
    </view>
    <view v-else class="page"><slot /></view>
    <GuideTour v-if="ready && !singlePage" :host-page="page" />
  </view>
</template>
<style>
.appearance-root { min-height: 100vh; background: var(--ink); color: var(--text); font-size: var(--font-16); font-family: var(--font-family, sans-serif); }
.dex-page-shell, .fixed-tabs-shell { height: 100vh; height: 100dvh; min-height: 0; overflow: hidden; display: flex; flex-direction: column; }
.dex-page-shell > .page, .fixed-tabs-shell > .page { flex: 1; min-height: 0; display: flex; flex-direction: column; padding-bottom: 12px; overflow: hidden; }
</style>
