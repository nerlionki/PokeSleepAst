<template>
  <scroll-view :scroll-x="true" class="horizontal-strip" @touchstart.stop @touchend.stop @touchcancel.stop><slot /></scroll-view>
</template>

<style scoped>
.horizontal-strip { width: 100%; }
</style>
