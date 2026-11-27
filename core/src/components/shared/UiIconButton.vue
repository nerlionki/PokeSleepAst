<script setup lang="ts">
defineProps<{ icon: 'back' | 'close'; label: string }>()
const emit = defineEmits<{ click: [] }>()
</script>

<template>
  <button class="ui-icon-button" type="button" :aria-label="label" @click="emit('click')">
    <span v-if="icon === 'back'" class="back-mark" aria-hidden="true" />
    <span v-else class="close-mark" aria-hidden="true">
      <span class="close-stroke" />
      <span class="close-stroke reverse" />
    </span>
  </button>
</template>

<style scoped>
.ui-icon-button {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: 42px;
  height: 42px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: var(--text);
  cursor: pointer;
}
.ui-icon-button::after { border: 0; }
.ui-icon-button:active { background: var(--line); }
.back-mark {
  display: block;
  box-sizing: border-box;
  width: 12px;
  height: 12px;
  border-left: 2px solid currentColor;
  border-bottom: 2px solid currentColor;
  transform: translateX(3px) rotate(45deg);
}
.close-mark {
  position: relative;
  display: block;
  width: 20px;
  height: 20px;
}
.close-stroke {
  position: absolute;
  display: block;
  top: 9px;
  left: 1px;
  width: 18px;
  height: 2px;
  border-radius: 1px;
  background: currentColor;
  transform: rotate(45deg);
}
.close-stroke.reverse { transform: rotate(-45deg); }
</style>
