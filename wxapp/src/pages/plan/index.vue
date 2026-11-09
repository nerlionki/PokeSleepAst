<script setup lang="ts">
import { usePageScroll } from '@tarojs/taro'
import { pageScrollLocks } from '../../platform/pageScrollLock'
import { recordPageScroll } from '../../platform/router'
usePageScroll(({ scrollTop }) => recordPageScroll('plan', scrollTop))
import ResourceLoading from '../../generated/components/shared/ResourceLoading.vue'
import { useResourcePage } from '../../platform/resourcePage'
const { ready, Content } = useResourcePage(() => import('./content.vue'))
</script>
<template><page-meta :page-style="pageScrollLocks.has('plan') ? 'overflow: hidden;' : ''" /><Content v-if="ready" /><ResourceLoading v-else /></template>
