<script setup lang="ts">
import { computed, toRef, useTemplateRef } from 'vue'
import { useTaskNavigationLock } from '../../composables/taskNavigationLock'
import { useProgressDialogFocus } from '#platform/progressDialogFocus'

const props = withDefaults(defineProps<{
  open: boolean
  title: string
  progress?: number | null
  stage?: string
  detail?: string
  notice?: string
  hint?: string
  cancellable?: boolean
  cancelText?: string
}>(), { progress: null, stage: '', detail: '', notice: '', hint: '', cancellable: false, cancelText: '取消' })
const emit = defineEmits<{ cancel: [] }>()
const percent = computed(() => props.progress != null && Number.isFinite(props.progress)
  ? Math.max(0, Math.min(100, Math.floor(props.progress))) : null)
const panel = useTemplateRef<HTMLElement>('panel')
const cancelButton = useTemplateRef<HTMLButtonElement>('cancelButton')
function requestCancel() { if (props.open && props.cancellable) emit('cancel') }
const open = toRef(props, 'open')
useTaskNavigationLock(open, requestCancel)
const { focus } = useProgressDialogFocus(open, () => props.cancellable ? cancelButton.value : panel.value)
</script>

<template>
  <Teleport to="body">
    <div v-if="open" v-back="requestCancel" class="overlay progress-dialog" role="dialog" aria-modal="true" :aria-label="title"
      @keydown.esc.prevent="requestCancel" @keydown.tab.prevent="focus" @touchmove.self.prevent>
      <section ref="panel" class="card stack progress-panel" tabindex="-1" role="status" aria-live="polite">
        <div v-if="percent == null" class="progress-spinner" aria-hidden="true" />
        <h3>{{ title }}</h3>
        <p v-if="notice" class="muted">{{ notice }}</p>
        <p v-if="stage">{{ stage }}</p>
        <div v-if="percent != null" class="progress-track" role="progressbar" :aria-label="title + '进度'" :aria-valuenow="percent" aria-valuemin="0" aria-valuemax="100">
          <div :style="{ width: percent + '%' }" />
        </div>
        <p v-if="percent != null || detail"><span v-if="percent != null">{{ percent }}%{{ detail ? ' · ' : '' }}</span>{{ detail }}</p>
        <slot />
        <p v-if="hint" class="muted">{{ hint }}</p>
        <button v-if="cancellable" ref="cancelButton" class="btn ghost" type="button" @click="requestCancel">{{ cancelText }}</button>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.progress-dialog { z-index: 10000; display: flex; align-items: center; justify-content: center; padding: 20px; }
.progress-panel { width: 100%; max-width: 380px; max-height: calc(100vh - 40px); max-height: calc(100dvh - 40px); overflow-y: auto; min-width: 0; box-sizing: border-box; text-align: center; box-shadow: var(--shadow); overflow-wrap: anywhere; }
.progress-track { height: 8px; background: var(--line); border-radius: 8px; overflow: hidden; }
.progress-track > div { height: 100%; background: var(--sage); transition: width .2s; }
.progress-spinner { width: 34px; height: 34px; justify-self: center; border: 3px solid var(--line); border-top-color: var(--sage); border-radius: 50%; animation: progress-spin .8s linear infinite; }
@keyframes progress-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .progress-spinner { animation: none; } .progress-track > div { transition: none; } }
</style>
