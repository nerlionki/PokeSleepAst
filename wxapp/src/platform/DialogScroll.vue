<template>
  <view class="dialog-scroll-viewport">
    <scroll-view class="dialog-scroll" :scroll-y="true">
      <custom-wrapper><slot /></custom-wrapper>
    </scroll-view>
  </view>
</template>

<style>
.dialog-scroll-viewport { flex: 1; height: 0; min-height: 0; min-width: 0; position: relative; overflow: hidden; }
.dialog-scroll-viewport > .dialog-scroll { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
</style>
