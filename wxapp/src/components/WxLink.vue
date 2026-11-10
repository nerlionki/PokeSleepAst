<script setup lang="ts">
import Taro from '@tarojs/taro'
import { t } from '../../../core/src/ui/i18n'
const props = defineProps<{ href?: string }>()
async function copy() { if (props.href) { await Taro.setClipboardData({ data: props.href }); await Taro.showToast({ title: t('链接已复制'), icon: 'none' }) } }
</script>
<template><text class="source-link" @tap="copy"><slot /></text></template>
