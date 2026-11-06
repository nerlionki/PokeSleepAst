<script setup lang="ts">
import { shallowRef } from 'vue'

const loaded = shallowRef(false)

function onLoad() { loaded.value = true }
function onError(event: { detail?: { errCode?: number; errMsg?: string } }) {
  loaded.value = false
  console.warn('[home-list-ad]', event.detail?.errCode, event.detail?.errMsg)
}
</script>

<template>
  <!-- The official component owns its rendering, including no-fill/error states.
       Only spacing follows load callbacks. No dismissal or timed refresh logic.
       Stop bubbling to the page's swipe navigation without intercepting ad taps. -->
  <view class="home-list-ad" :class="{ 'home-list-ad-loaded': loaded }" @touchstart.stop @touchend.stop @touchcancel.stop>
    <ad-custom unit-id="adunit-d01f9b27695a13a4" @load="onLoad" @error="onError" />
  </view>
</template>

<style>
.home-list-ad { flex: none; min-width: 0; width: 100%; box-sizing: border-box; }
.home-list-ad-loaded { padding-top: 16px; padding-bottom: 16px; }
</style>
