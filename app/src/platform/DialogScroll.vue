<template>
  <div class="dialog-scroll"><slot /></div>
</template>

<style scoped>
.dialog-scroll { min-height: 0; min-width: 0; overflow-y: auto; overscroll-behavior: contain; }
</style>
