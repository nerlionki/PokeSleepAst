<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import UiIconButton from '../../../core/src/components/shared/UiIconButton.vue'
import { t } from '../../../core/src/ui/i18n'
import { useDialogLayer } from '../../../core/src/ui/dialogLayer'
import { backStack } from '../navigation/back'
import DialogScroll from './DialogScroll.vue'

const props = withDefaults(defineProps<{
  title: string
  variant?: 'sheet' | 'drawer' | 'picker'
  backLabel?: string
}>(), { variant: 'sheet' })
const emit = defineEmits<{ close: []; back: [] }>()
const layer = useDialogLayer()
const dialog = ref<HTMLElement>()
let previousFocus: Element | null = null

function close() {
  emit('close')
}

function back() {
  if (props.backLabel) emit('back')
  else close()
}

onMounted(() => {
  previousFocus = document.activeElement
  dialog.value?.focus({ preventScroll: true })
})

onBeforeUnmount(() => {
  const restore = previousFocus
  void nextTick(() => {
    if (restore instanceof HTMLElement && restore.isConnected) restore.focus({ preventScroll: true })
  })
})
</script>

<template>
  <Teleport to="body">
    <div v-back="back" class="overlay" :class="variant === 'sheet' ? undefined : variant + '-overlay'" :style="{ zIndex: layer }" @click.self="close"
      @touchstart.stop @touchend.stop @touchcancel.stop>
      <section ref="dialog" class="sheet" :class="variant === 'sheet' ? 'modal-sheet' : variant === 'drawer' ? 'drawer-page modal-drawer' : 'picker-sheet'" role="dialog" aria-modal="true" :aria-label="title"
        tabindex="-1" @keydown.esc.stop.prevent="backStack.handle()">
        <header :class="variant === 'drawer' ? 'drawer-bar' : variant === 'picker' ? 'picker-header' : 'modal-header'">
          <UiIconButton v-if="backLabel || variant === 'drawer'" icon="back" :label="backLabel || t('返回')" @click="back" />
          <h3>{{ title }}</h3>
          <div v-if="variant === 'drawer'" />
          <UiIconButton v-else icon="close" :label="t('关闭')" @click="close" />
        </header>
        <slot v-if="variant === 'picker'" />
        <DialogScroll v-else :class="{ 'modal-drawer-scroll': variant === 'drawer' }">
          <div class="stack" :class="variant === 'drawer' ? 'drawer-body modal-drawer-body' : 'modal-body'"><slot /></div>
        </DialogScroll>
        <footer v-if="$slots.footer" class="stack" :class="variant === 'picker' ? 'picker-editor-footer' : 'modal-footer'"><slot name="footer" /></footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.sheet.modal-sheet {
  display: flex;
  flex-direction: column;
  padding: 0;
  overflow: hidden;
  outline: none;
}
.modal-header,
.modal-body,
.modal-footer {
  padding-inline: calc(16px + var(--safe-left, 0px)) calc(16px + var(--safe-right, 0px));
}
.modal-header {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-block: 6px;
  border-bottom: 1px solid var(--line);
}
.modal-header h3 { min-width: 0; overflow-wrap: anywhere; }
.modal-body {
  align-content: start;
  padding-top: 12px;
  padding-bottom: calc(20px + var(--safe-bottom, 0px));
}
.modal-footer {
  flex: none;
  border-top: 1px solid var(--line);
  padding-top: 10px;
  padding-bottom: calc(12px + var(--safe-bottom, 0px));
}
.drawer-page.modal-drawer { display: flex; flex-direction: column; }
.modal-drawer .drawer-bar { flex: none; }
.modal-drawer-scroll { flex: 1; }
.drawer-body.modal-drawer-body { overflow: visible; }
</style>
