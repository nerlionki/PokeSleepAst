<script setup lang="ts">
import { useUpdateStore } from '../../stores/update'
const store = useUpdateStore()
</script>

<template>
  <section v-if="store.supported" class="stack update-settings">
    <h3>应用更新</h3>
    <div class="row">
      <span class="muted">当前版本 {{ store.currentVersion }}</span>
      <button class="btn ghost" type="button" :disabled="store.busy" @click="store.check()">
        {{ store.phase === 'checking' ? '正在检查…' : '检查更新' }}
      </button>
    </div>
    <a href="https://github.com/nerlionki/PokeSleepAst/releases" target="_blank" rel="noopener noreferrer">前往发布页下载</a>
    <p v-if="store.message" class="muted" role="status">{{ store.message }}</p>
  </section>
</template>

<style scoped>
.update-settings { border-bottom: 1px solid var(--line); padding-bottom: 16px; }
</style>
