<script setup lang="ts">
  import { gameText } from '../../ui/i18n';
  import FallbackImage from '../shared/FallbackImage.vue';
  import { EVENT_PARAMETERS } from '../../calc/activities';
  import { localImage } from '#platform/images';
  const flower = EVENT_PARAMETERS.flower;
  const flowerIcon = localImage(flower.imageFile);
  const seeds = flower.seeds;
</script>

<template>
  <div class="stack">
    <article class="card stack">
      <div class="row">
        <FallbackImage
          loading="lazy"
          decoding="async"
          class="flower-icon"
          :src="flowerIcon"
          alt=""
          aria-hidden="true"
          ><template #fallback></template
        ></FallbackImage>
        <h3>{{ gameText(flower.name) }}</h3>
      </div>
      <p>{{ gameText(flower.description) }}</p>
      <p class="muted">{{ gameText(flower.rules) }}</p>
    </article>
    <div v-for="seed in seeds" :key="seed.name" class="card flower-seed">
      <span
        class="seed-color"
        :style="{ backgroundColor: seed.color }"
        aria-hidden="true"
      />
      <div>
        <strong>{{ gameText(seed.name) }}</strong>
        <p>{{ gameText(seed.effect) }}</p>
      </div>
    </div>
    <p class="muted">{{ gameText(flower.tutorial) }}</p>
    <p class="muted">{{ gameText(flower.scope) }}</p>
  </div>
</template>

<style scoped>
  .flower-icon {
    width: 54px;
    height: 54px;
    object-fit: contain;
  }
  .flower-seed {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .seed-color {
    width: 30px;
    height: 30px;
    border: 1px solid var(--rarity-neutral);
    border-radius: 50%;
    flex: 0 0 auto;
  }
  .flower-seed p {
    margin: 4px 0 0;
  }
</style>
