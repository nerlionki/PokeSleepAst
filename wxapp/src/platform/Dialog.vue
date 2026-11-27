<script setup lang="ts">
import UiIconButton from '../generated/components/shared/UiIconButton.vue'
import { t } from './i18nFacade'
import OverlayPortal from './OverlayPortal.vue'
import DialogScroll from './DialogScroll.vue'
import { useDialogLayer } from '../../../core/src/ui/dialogLayer'

const props = withDefaults(defineProps<{
  title: string
  variant?: 'sheet' | 'drawer' | 'picker'
  backLabel?: string
}>(), { variant: 'sheet' })
const emit = defineEmits<{ close: []; back: [] }>()
const layer = useDialogLayer()

function close() {
  emit('close')
}

function back() {
  if (props.backLabel) emit('back')
  else close()
}
</script>

<template>
  <OverlayPortal>
    <view v-back="back" class="overlay" :class="variant === 'sheet' ? undefined : variant + '-overlay'" :style="{ zIndex: layer }" @click.self="close"
      @touchstart.stop @touchend.stop @touchcancel.stop>
      <view class="sheet" :class="variant === 'sheet' ? 'modal-sheet' : variant === 'drawer' ? 'drawer-page modal-drawer' : 'picker-sheet'" role="dialog" aria-modal="true" :aria-label="title">
        <view :class="variant === 'drawer' ? 'drawer-bar' : variant === 'picker' ? 'picker-header' : 'modal-header'">
          <UiIconButton v-if="backLabel || variant === 'drawer'" icon="back" :label="backLabel || t('返回')" @click="back" />
          <h3>{{ title }}</h3>
          <view v-if="variant === 'drawer'" />
          <UiIconButton v-else icon="close" :label="t('关闭')" @click="close" />
        </view>
        <slot v-if="variant === 'picker'" />
        <DialogScroll v-else :class="{ 'modal-drawer-scroll': variant === 'drawer' }">
          <view class="stack" :class="variant === 'drawer' ? 'drawer-body modal-drawer-body' : 'modal-body'"><slot /></view>
        </DialogScroll>
        <view v-if="$slots.footer" class="stack" :class="variant === 'picker' ? 'picker-editor-footer' : 'modal-footer'"><slot name="footer" /></view>
      </view>
    </view>
  </OverlayPortal>
</template>

<style>
.sheet.modal-sheet {
  display: flex;
  flex-direction: column;
  height: min(82vh, var(--visible-height, 100vh), 720px);
  padding: 0;
  overflow: hidden;
}
.modal-header,
.modal-body,
.modal-footer {
  padding-left: calc(16px + var(--safe-left, 0px));
  padding-right: calc(16px + var(--safe-right, 0px));
}
.modal-header {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-top: 6px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--line);
}
.modal-header h3 { min-width: 0; overflow-wrap: anywhere; }
.modal-body { padding-top: 12px; padding-bottom: calc(20px + var(--safe-bottom, 0px)); }
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
