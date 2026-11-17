<template>
  <scroll-view
    class="ingredient-rank-scroll"
    :scroll-y="true"
    @touchstart.stop
    @touchend.stop
    @touchcancel.stop
  >
    <custom-wrapper>
      <view class="stack"><slot /></view>
    </custom-wrapper>
  </scroll-view>
</template>

<style>
.sheet.ingredient-ranking {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  height: 76vh;
  max-height: none;
  overflow: hidden;
}

.ingredient-rank-scroll {
  flex: 1;
  width: 100%;
  height: 0;
  min-height: 0;
}
</style>
