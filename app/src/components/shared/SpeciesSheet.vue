<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { POKEDEX } from '../../calc/data'
import { pokeHit } from '../../calc/pokeSearch'
import PokeSprite from './PokeSprite.vue'

const emit = defineEmits<{ pick: [id: number], close: [] }>()
const q = shallowRef('')
const list = computed(() => POKEDEX.filter((poke) => pokeHit(poke, q.value)))
</script>

<template>
  <div class="overlay" @click.self="emit('close')">
    <section class="sheet stack">
      <div class="row">
        <h3>添加宝可梦</h3>
        <button class="btn ghost" type="button" @click="emit('close')">关闭</button>
      </div>
      <input v-model="q" class="picker-search" placeholder="搜索中文、英文或编号">
      <div class="poke-wall">
        <button v-for="poke in list" :key="poke.id" type="button" class="poke-wall-cell" @click="emit('pick', poke.id)">
          <PokeSprite :id="poke.id" :name="poke.name" />
          <span>{{ poke.name }}</span>
        </button>
      </div>
      <p v-if="!list.length" class="muted">没有匹配的宝可梦。</p>
    </section>
  </div>
</template>
