<template>
  <div class="horizontal-strip" @touchstart.stop @touchend.stop @touchcancel.stop><slot /></div>
</template>

<style scoped>
.horizontal-strip { overflow-x: auto; scrollbar-width: none; }
</style>
