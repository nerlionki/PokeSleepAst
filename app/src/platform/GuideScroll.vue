<template><div class="guide-scroll"><slot /></div></template>
<style scoped>
.guide-scroll { height: 100%; overflow-y: auto; overscroll-behavior: contain; scrollbar-color: var(--line) transparent; }
</style>
