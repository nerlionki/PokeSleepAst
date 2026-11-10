<template>
  <scroll-view :scroll-x="true" class="horizontal-strip" style="width: 100%" @touchstart.stop @touchend.stop @touchcancel.stop><slot /></scroll-view>
</template>
