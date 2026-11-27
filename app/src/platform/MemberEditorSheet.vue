<script setup lang="ts">
defineProps<{ close: () => void }>()
</script>

<template>
  <div
    v-back="close"
    class="overlay"
    @click.self="close"
    @touchstart.stop
    @touchend.stop
    @touchcancel.stop
  >
    <section class="sheet stack member-editor-sheet"><slot /></section>
  </div>
</template>
