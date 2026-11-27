<script setup lang="ts">
import OverlayPortal from './OverlayPortal.vue'

defineProps<{ close: () => void }>()
</script>

<template>
  <OverlayPortal>
    <view
      v-back="close"
      class="overlay"
      @click.self="close"
      @touchstart.stop
      @touchend.stop
      @touchcancel.stop
    >
      <view class="sheet stack member-editor-sheet">
        <scroll-view :scroll-y="true" class="member-editor-scroll">
          <custom-wrapper>
            <view class="stack member-editor-content"><slot /></view>
          </custom-wrapper>
        </scroll-view>
      </view>
    </view>
  </OverlayPortal>
</template>

<style>
.sheet.member-editor-sheet { display: block; height: var(--visible-height, 82vh); max-height: calc(var(--visible-height, 100vh) - 24px); padding: 0; overflow: hidden; }
.member-editor-scroll { height: 100%; width: 100%; }
.member-editor-content { padding: 16px 16px 28px; padding-bottom: calc(28px + env(safe-area-inset-bottom)); }
.member-editor-content .btn { padding: 10px 12px; border-radius: 12px; }
</style>
