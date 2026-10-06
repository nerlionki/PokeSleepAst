<script setup lang="ts">
import Taro from '@tarojs/taro'
const props = defineProps<{ href?: string }>()
async function copy() { if (props.href) { await Taro.setClipboardData({ data: props.href }); await Taro.showToast({ title: '链接已复制', icon: 'none' }) } }
</script>
<template><text class="source-link" @tap="copy"><slot /></text></template>
