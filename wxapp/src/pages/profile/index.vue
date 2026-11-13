<script lang="ts">
import { createPageShare } from '../../platform/share'
export default createPageShare('profile')
</script>
<script setup lang="ts">
import { usePageScroll } from '@tarojs/taro'
import { pageScrollLocks } from '../../platform/pageScrollLock'
import { recordPageScroll } from '../../platform/router'
import ResourceLoading from '../../generated/components/shared/ResourceLoading.vue'
import { useResourcePage } from '../../platform/resourcePage'
usePageScroll(({ scrollTop }) => recordPageScroll('profile', scrollTop))
const { ready, Content } = useResourcePage(() => import('./content.vue'))
</script>
<template><page-meta :page-style="pageScrollLocks.has('profile') ? 'overflow: hidden;' : ''" /><Content v-if="ready" /><ResourceLoading v-else /></template>
