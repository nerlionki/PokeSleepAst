<script setup lang="ts">
import { onMounted, onScopeDispose, shallowRef, watch } from 'vue'
import { useDidHide, useDidShow } from '@tarojs/taro'
import { homeListAdDismissed } from '../platform/homeListAd'

const props = defineProps<{ eligible: boolean }>()
const pageVisible = shallowRef(true)
const keyboardOpen = shallowRef(false)
const loaded = shallowRef(false)
const failed = shallowRef(false)

useDidShow(() => { pageVisible.value = true })
useDidHide(() => { pageVisible.value = false; keyboardOpen.value = false })
function keyboardChanged(event: { height: number }) { keyboardOpen.value = event.height > 0 }
onMounted(() => { wx.onKeyboardHeightChange(keyboardChanged) })
onScopeDispose(() => { wx.offKeyboardHeightChange(keyboardChanged) })
watch(() => props.eligible && pageVisible.value && !keyboardOpen.value, visible => {
  if (!visible) loaded.value = false
})
function onLoad() { loaded.value = true; failed.value = false }
function onError(event: { detail?: { errCode?: number; errMsg?: string } }) {
  loaded.value = false
  failed.value = true
  console.warn('[home-list-ad]', event.detail?.errCode, event.detail?.errMsg)
}
</script>

<template>
  <!-- Keep a failed native component mounted for a possible subsequent load callback.
       Do not set ad-intervals: tab changes and details must not trigger timed refreshes.
       The separate collapse button never overlays or modifies the native ad. -->
  <view v-if="eligible && pageVisible && !keyboardOpen && !homeListAdDismissed" class="home-list-ad" :class="{ 'home-list-ad-loaded': loaded }" :style="{ display: failed ? 'none' : undefined }">
    <ad-custom unit-id="adunit-d01f9b27695a13a4" @load="onLoad" @error="onError" />
    <view v-if="loaded" class="home-list-ad-actions">
      <button class="home-list-ad-dismiss" @tap.stop="homeListAdDismissed = true">收起广告</button>
    </view>
  </view>
</template>

<style>
.home-list-ad { flex: none; min-width: 0; width: 100%; box-sizing: border-box; }
.home-list-ad-loaded { padding-top: 8px; padding-bottom: 8px; }
.home-list-ad-actions { display: flex; justify-content: flex-end; padding-top: 12px; }
.home-list-ad-dismiss { margin: 0; padding: 0 12px; min-height: 32px; line-height: 32px; border: 0; border-radius: 6px; background: var(--ink-2); color: var(--muted); font: inherit; font-size: 12px; }
.home-list-ad-dismiss::after { border: 0; }
</style>
