<script setup lang="ts">
import ResourceLoading from '../../generated/components/shared/ResourceLoading.vue'
import { useResourcePage } from '../../platform/resourcePage'
const { ready, Content } = useResourcePage(() => import('./content.vue'))
</script>
<template><Content v-if="ready" /><ResourceLoading v-else /></template>
