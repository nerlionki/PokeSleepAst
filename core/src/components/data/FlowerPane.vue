<script setup lang="ts">
import { EVENT_PARAMETERS } from '../../calc/activities'
const flower = EVENT_PARAMETERS.flower
const seeds = flower.seeds
</script>

<template>
  <div class="stack">
    <article class="card stack">
      <div class="row"><img loading="lazy" decoding="async" class="flower-icon" :src="flower.icon" :alt="flower.name"><h3>{{ flower.name }}</h3></div>
      <p>{{ flower.description }}</p>
      <p class="muted">{{ flower.rules }}</p>
    </article>
    <div v-for="seed in seeds" :key="seed.name" class="card flower-seed">
      <span class="seed-color" :style="{ backgroundColor: seed.color }" aria-hidden="true" />
      <div><strong>{{ seed.name }}</strong><p>{{ seed.effect }}</p></div>
    </div>
    <p class="muted">{{ flower.tutorial }}</p>
    <p class="muted">{{ flower.scope }}</p>
  </div>
</template>

<style scoped>
.flower-icon { width: 54px; height: 54px; object-fit: contain; }
.flower-seed { display: flex; align-items: center; gap: 10px; }
.seed-color { width: 30px; height: 30px; border: 1px solid var(--rarity-neutral); border-radius: 50%; flex: 0 0 auto; }
.flower-seed p { margin: 4px 0 0; }
</style>
