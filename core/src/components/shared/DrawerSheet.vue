<script setup lang="ts">
defineProps<{ title: string }>()
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <Teleport to="body">
    <div v-back="() => emit('close')" class="overlay drawer-overlay" @click.self="emit('close')">
      <section class="sheet drawer-page">
        <header class="drawer-bar">
          <button class="drawer-back" type="button" aria-label="返回" @click="emit('close')">‹</button>
          <h3>{{ title }}</h3>
          <span />
        </header>
        <div class="drawer-body stack">
          <slot />
        </div>
      </section>
    </div>
  </Teleport>
</template>
