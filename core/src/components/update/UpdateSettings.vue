<script setup lang="ts">
import { t as translateUi } from '../../ui/i18n'
import { useUpdateStore } from '../../stores/update'
const store = useUpdateStore()
</script>

<template>
  <section v-if="store.supported" class="stack update-settings">
    <h3>{{ translateUi("应用更新") }}</h3>
    <div class="row">
      <span class="muted">{{ translateUi("当前版本") }} {{ store.currentVersion }}</span>
      <button class="btn ghost" type="button" :disabled="store.busy" @click="store.check()">
        {{ store.phase === 'checking' ? translateUi("正在检查…") : translateUi("检查更新") }}
      </button>
    </div>
    <a href="https://github.com/nerlionki/PokeSleepAst/releases" target="_blank" rel="noopener noreferrer">{{ translateUi("前往发布页下载") }}</a>
    <p v-if="store.message" class="muted" role="status">{{ translateUi(store.message) }}</p>
  </section>
</template>

<style scoped>
.update-settings { border-bottom: 1px solid var(--line); padding-bottom: 16px; }
</style>
