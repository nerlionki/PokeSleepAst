<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { pageScrollLocks } from './pageScrollLock'
import { route } from './router'

const props = defineProps<{ resetOn?: string }>()
const anchor = shallowRef<string>()
const page = route.name
const scrollEnabled = computed(() => !pageScrollLocks.has(page))
watch(() => props.resetOn, () => {
  anchor.value = anchor.value === 'tab-content-start' ? 'tab-content-top' : 'tab-content-start'
})
</script>

<template>
  <view class="tab-content-viewport">
    <scroll-view class="tab-content" :scroll-y="scrollEnabled" :scroll-into-view="anchor">
      <view id="tab-content-top" />
      <view id="tab-content-start" />
      <slot />
    </scroll-view>
  </view>
</template>

<style>
.tab-content-viewport { flex: 1; height: 0; min-height: 0; min-width: 0; position: relative; }
.tab-content-viewport > .tab-content { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
</style>
