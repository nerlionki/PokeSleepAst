<script setup lang="ts">
import { t as translateUi } from '../../../core/src/ui/i18n'
</script>
<template>
  <view class="stack">
    <button class="card wx-share-btn" open-type="share" hover-class="wx-share-btn">
      <text>{{ translateUi('分享给好友') }}</text>
      <text class="wx-share-chevron">›</text>
    </button>
    <text class="muted">{{ translateUi('发送面板里可选好友或微信群。分享到朋友圈请点右上角「···」，再选「分享到朋友圈」。公开页面不会带上本机 Box、队伍或备份。') }}</text>
  </view>
</template>
<style>
.wx-share-btn { display: flex; align-items: center; justify-content: space-between; width: 100%; margin: 0; color: var(--text); font: inherit; line-height: 1.5; text-align: left; }
.wx-share-btn::after { border: none; }
.wx-share-chevron { color: var(--muted); }
</style>
