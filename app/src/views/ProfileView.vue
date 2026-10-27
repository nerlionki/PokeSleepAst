<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Component from '../../../core/src/views/ProfileView.vue'
import AppLogsPane from '../components/profile/AppLogsPane.vue'
const route = useRoute()
const router = useRouter()
const logsOpen = computed(() => route.query.tab === 'logs')
function show(tab: 'home' | 'logs') { void router.push({ path: route.path, query: { ...route.query, tab } }) }
</script>

<template>
  <div v-if="logsOpen" class="stack">
    <div class="row"><button class="btn ghost" type="button" @click="show('home')">返回我的</button><h2>应用日志</h2></div>
    <AppLogsPane />
  </div>
  <Component v-else>
    <template #app-tools>
      <button class="card app-logs-entry" type="button" @click="show('logs')"><span>应用日志</span><span aria-hidden="true">›</span></button>
    </template>
  </Component>
</template>

<style scoped>
.app-logs-entry { display: flex; align-items: center; justify-content: space-between; gap: 16px; width: 100%; color: var(--text); font: inherit; text-align: left; }
.app-logs-entry > span:last-child { color: var(--muted); }
</style>
