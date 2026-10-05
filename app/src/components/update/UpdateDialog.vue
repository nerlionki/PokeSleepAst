<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch, nextTick, shallowRef } from 'vue'
import { useUpdateStore } from '../../stores/update'
const store = useUpdateStore()
const panel = shallowRef<HTMLElement | null>(null)
let previousFocus: HTMLElement | null = null
const percent = computed(() => Math.min(100, Math.floor(store.progress.downloaded / Math.max(1, store.progress.total) * 100)))
const size = computed(() => ((store.update?.size ?? 0) / 1024 / 1024).toFixed(1))
const action = computed(() => store.phase === 'downloading' ? `正在下载 ${percent.value}%`
  : store.phase === 'verifying' ? '正在校验…' : store.phase === 'ready' ? '继续安装' : store.error ? '重试更新' : '立即更新')

function onKey(event: KeyboardEvent) {
  if (!store.visible || !panel.value) return
  if (event.key === 'Escape') { event.preventDefault(); void store.dismiss(); return }
  if (event.key !== 'Tab') return
  const buttons = [...panel.value.querySelectorAll<HTMLElement>('button:not(:disabled)')]
  const first = buttons[0], last = buttons.at(-1)
  if (!first || !last) { event.preventDefault(); return }
  if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.value)) {
    event.preventDefault(); last.focus()
  } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
}
watch(() => store.visible, async (open) => {
  if (open) { previousFocus = document.activeElement as HTMLElement; await nextTick(); panel.value?.focus() }
  else previousFocus?.focus()
})
onMounted(() => document.addEventListener('keydown', onKey))
onUnmounted(() => document.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <div v-if="store.visible && store.update" v-back="() => { void store.dismiss() }" class="overlay update-overlay" @click.self="store.dismiss()">
      <section ref="panel" class="sheet stack update-dialog" role="dialog" aria-modal="true" aria-labelledby="update-title" tabindex="-1">
        <h2 id="update-title">发现新版本 {{ store.update.version }}</h2>
        <p class="muted">当前 {{ store.currentVersion }} · 安装包 {{ size }} MB</p>
        <p class="update-notes">{{ store.update.notes || '新版本已发布，欢迎更新。' }}</p>
        <div v-if="store.phase === 'downloading' || store.phase === 'verifying'" class="stack" role="status" aria-live="polite">
          <progress :value="percent" max="100" aria-label="安装包下载进度" />
          <span class="muted">{{ action }}</span>
        </div>
        <p v-if="store.message && store.phase === 'ready'" class="muted" role="status">{{ store.message }}</p>
        <p v-if="store.error" class="update-error" role="alert">{{ store.error }}</p>
        <button class="btn" type="button" :disabled="store.busy" @click="store.install()">{{ action }}</button>
        <div class="row">
          <button class="btn ghost" type="button" :disabled="store.busy" @click="store.dismiss()">稍后提醒</button>
          <button class="btn ghost" type="button" :disabled="store.busy" @click="store.dismiss(true)">跳过此版本</button>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.update-overlay { z-index: 60; align-items: center; padding: 16px; }
.update-dialog { width: 100%; max-width: 520px; margin: auto; border: 1px solid var(--line); border-radius: 24px; outline: none; }
.update-notes { white-space: pre-wrap; overflow-wrap: anywhere; max-height: 35dvh; overflow-y: auto; }
.update-error { color: var(--rose); }
progress { width: 100%; accent-color: var(--amber); }
button:disabled { opacity: .6; cursor: wait; }
</style>
