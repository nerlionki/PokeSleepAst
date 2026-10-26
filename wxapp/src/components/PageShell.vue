<script setup lang="ts">
import { onMounted, shallowRef, watch } from 'vue'
import Taro, { useDidShow } from '@tarojs/taro'
import { taskNavigationLocked } from '../../../core/src/composables/taskNavigationLock'
import { hydrate } from '../platform/hydrate'
import { route } from '../platform/router'
import { useAppearanceStore } from '../../../core/src/stores/appearance'
import { luminance } from '../../../core/src/ui/appearance'
const props = defineProps<{ page: string }>()
const appearance = useAppearanceStore()
function applyBars() {
  if (route.name !== props.page) return
  const p = appearance.palette
  void Taro.setNavigationBarColor({ backgroundColor: p.ink, frontColor: luminance(p.ink) > 0.179 ? '#000000' : '#ffffff' }).catch(() => {})
  void Taro.setTabBarStyle({ backgroundColor: p['ink-2'], color: p.muted, selectedColor: p.sage, borderStyle: luminance(p.ink) > 0.179 ? 'white' : 'black' }).catch(() => {})
  void Taro.setBackgroundColor({ backgroundColor: p.ink }).catch(() => {})
}
watch(() => appearance.palette, applyBars, { deep: true })
const ready = shallowRef(false), error = shallowRef('')
function active() {
  if (taskNavigationLocked.value && route.name !== props.page) {
    void Taro.switchTab({ url: '/pages/' + route.name + '/index' })
    return
  }
  if (route.name !== props.page) route.query = {}; route.name = props.page; route.path = '/' + props.page }
async function load() { try { await hydrate(); ready.value = true; error.value = '' } catch (cause) { error.value = cause instanceof Error ? cause.message : '本机数据无法加载，请重试' } }
onMounted(() => { active(); void load() })
useDidShow(() => { active(); applyBars() })
</script>
<template>
  <view class="appearance-root" :style="appearance.variables">
    <view v-if="error" class="card stack"><text>{{ error }}</text><button class="btn" @tap="load">重试</button></view>
    <view v-else-if="!ready" class="muted">正在加载本机数据…</view>
    <view v-else class="page"><slot /></view>
  </view>
</template>
<style>
.appearance-root { min-height: 100vh; background: var(--ink); color: var(--text); font-size: var(--font-16); }
</style>
