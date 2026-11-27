<script setup lang="ts">
import { t as translateUi } from '../../ui/i18n'
import { computed, toRef, useTemplateRef } from 'vue'
import { useTaskNavigationLock } from '../../composables/taskNavigationLock'
import ProgressDialogFrame from '#platform/ProgressDialogFrame.vue'
import DialogScroll from '#platform/DialogScroll.vue'
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
  <ProgressDialogFrame :open="open" :label="translateUi(title)" :request-cancel="requestCancel" @focus="focus">
    <section ref="panel" class="card stack progress-panel" tabindex="-1" role="status" aria-live="polite">
      <h3>{{ translateUi(title) }}</h3>
      <DialogScroll class="progress-body-scroll">
        <div class="stack">
          <div v-if="percent == null" class="progress-spinner" aria-hidden="true" />
          <p v-if="notice" class="muted">{{ translateUi(notice) }}</p>
          <p v-if="stage">{{ translateUi(stage) }}</p>
          <div v-if="percent != null" class="progress-track" role="progressbar" :aria-label="translateUi('{title}进度', { title: translateUi(title) })" :aria-valuenow="percent" aria-valuemin="0" aria-valuemax="100">
            <div :style="{ width: percent + '%' }" />
          </div>
          <p v-if="percent != null || detail"><span v-if="percent != null">{{ percent }}%{{ detail ? ' · ' : '' }}</span>{{ detail }}</p>
          <slot />
          <p v-if="hint" class="muted">{{ translateUi(hint) }}</p>
        </div>
      </DialogScroll>
      <button v-if="cancellable" ref="cancelButton" class="btn ghost" type="button" @click="requestCancel">{{ translateUi(cancelText) }}</button>
    </section>
  </ProgressDialogFrame>
</template>

<style scoped>
.progress-panel { display: flex; flex-direction: column; width: 100%; max-width: 380px; max-height: calc(var(--visible-height, 100vh) - 40px); overflow: hidden; min-width: 0; box-sizing: border-box; text-align: center; overflow-wrap: anywhere; }
.progress-panel > h3, .progress-panel > button { flex: none; }
.progress-body-scroll { min-height: min(120px, 25vh); }
.progress-track { height: 8px; background: var(--line); border-radius: 8px; overflow: hidden; }
.progress-track > div { height: 100%; background: var(--sage); transition: width .2s; }
.progress-spinner { width: 34px; height: 34px; justify-self: center; border: 3px solid var(--line); border-top-color: var(--sage); border-radius: 50%; animation: progress-spin .8s linear infinite; }
@keyframes progress-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .progress-spinner { animation: none; } .progress-track > div { transition: none; } }
</style>
