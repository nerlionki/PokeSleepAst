<script setup lang="ts">
import { onMounted, shallowRef } from 'vue'
import { useDidShow } from '@tarojs/taro'
import { hydrate } from '../platform/hydrate'
import { route } from '../platform/router'
import SettingsPanel from '../generated/components/layout/SettingsPanel.vue'
const props = defineProps<{ page: string }>()
const ready = shallowRef(false), error = shallowRef(''), settings = shallowRef(false)
function active() { if (route.name !== props.page) route.query = {}; route.name = props.page; route.path = '/' + props.page }
async function load() { try { await hydrate(); ready.value = true; error.value = '' } catch (cause) { error.value = cause instanceof Error ? cause.message : '本机数据无法加载，请重试' } }
onMounted(() => { active(); void load() })
useDidShow(active)
</script>
<template>
  <view class="wx-settings"><button class="btn ghost" @tap="settings = true">全局设置 ⚙</button></view>
  <view v-if="error" class="card stack"><text>{{ error }}</text><button @tap="load">重试</button></view>
  <view v-else-if="!ready" class="muted">正在加载本机数据…</view>
  <view v-else class="page"><slot /></view>
  <SettingsPanel v-if="settings && ready" @close="settings = false" />
</template>
