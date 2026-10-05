<script setup lang="ts">
const seeds = [
  { name: '红色种子', color: '#e67975', effect: '每天第 1 次睡眠研究获得的糖果 ×2.5' },
  { name: '蓝色种子', color: '#7baed4', effect: '帮手宝可梦获得的睡眠 EXP ×3' },
  { name: '黄色种子', color: '#e9c95f', effect: '每天 1 次，点心时间必有 1 只宝可梦处于贪吃状态' },
  { name: '紫色种子', color: '#b69ad2', effect: '睡眠研究获得的梦之碎片 ×2.5' },
  { name: '白色种子', color: '#f4f2e8', effect: '获得净白薄荷 ×1' },
]
</script>

<template>
  <div class="stack">
    <article class="card stack">
      <div class="row"><img class="flower-icon" src="/items/happy-flower.webp" alt="彩庆花"><h3>彩庆花</h3></div>
      <p>活动期间每天种下 1 颗种子。种下后测量睡眠，醒来时开花；即使不做睡眠研究，隔天登录也会开花。忘记种植时，系统会从剩余种子里自动选 1 颗。</p>
      <p class="muted">每种颜色各 1 颗，只能种 1 次；当天选定后不能更换。开花后的奖励持续至当次活动结束；只适用于种下种子后开始测量的睡眠资料。不同活动可能调整颜色和奖励。</p>
    </article>
    <div v-for="seed in seeds" :key="seed.name" class="card flower-seed">
      <span class="seed-color" :style="{ backgroundColor: seed.color }" aria-hidden="true" />
      <div><strong>{{ seed.name }}</strong><p>{{ seed.effect }}</p></div>
    </div>
    <p class="muted">首次种花的教学还可获得净白薄荷 ×1；道具包最多持有 2 个。</p>
    <p class="muted">以上五色效果依据 2026 年三周年活动规则，非当前常驻加成。</p>
    <p><a href="https://www.pokemonsleep.net/news/343138353434383532363837333838363733/" target="_blank" rel="noopener noreferrer">官方三周年活动说明</a> · <a href="https://pks.raenonx.cc/zh/event/list/3rdAnniv" target="_blank" rel="noopener noreferrer">RAE 三周年活动资料</a></p>
  </div>
</template>

<style scoped>
.flower-icon { width: 54px; height: 54px; object-fit: contain; }
.flower-seed { display: flex; align-items: center; gap: 10px; }
.seed-color { width: 30px; height: 30px; border: 1px solid #b9b5ad; border-radius: 50%; flex: 0 0 auto; }
.flower-seed p { margin: 4px 0 0; }
</style>
