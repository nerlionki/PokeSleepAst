<script setup lang="ts">
import { computed } from 'vue'
import { BERRIES, ISLANDS } from '../../calc/data'
import { EX_MAIN, canPickBerries, normalizeEx2Berries } from '../../calc/defaults'
import { isExIsland } from '../../calc/exEffects'
import type { Settings } from '../../types'
import BerryIcon from './BerryIcon.vue'
type Environment = Pick<Settings, 'island' | 'berries' | 'helpingBonus' | 'exBuff' | 'exDebuff' | 'exWeeklyBonus'>
const props = defineProps<{ value: Environment }>()
const emit = defineEmits<{ change: [patch: Partial<Environment>] }>()
const ex = computed(() => isExIsland(props.value.island))
const mainChoices = computed(() => BERRIES.filter(berry => props.value.island !== 'cyanex' || EX_MAIN.includes(berry.name)))
const secondary = computed(() => BERRIES.filter(berry => berry.name !== props.value.berries[0]))
const extra = computed({ get: () => props.value.helpingBonus, set: (value: number) => emit('change', { helpingBonus: Math.min(5, Math.max(0, Math.floor(Number(value) || 0))) }) })
const buff = computed({ get: () => props.value.exBuff !== false, set: (value: boolean) => emit('change', { exBuff: value }) })
const debuff = computed({ get: () => props.value.exDebuff !== false, set: (value: boolean) => emit('change', { exDebuff: value }) })
function pickMain(name: string) {
  const berries = [name, ...props.value.berries.slice(1).filter(item => item !== name)].slice(0, 3)
  emit('change', { berries: props.value.island === 'cyanex' ? normalizeEx2Berries(berries) : berries })
}
function toggle(name: string) {
  const current = props.value.berries
  if (ex.value && name === current[0]) return
  const berries = current.includes(name) ? current.filter(item => item !== name) : current.length < 3 ? [...current, name] : current
  emit('change', { berries })
}
</script>
<template>
  <div class="stack">
    <div class="field"><label>计算营地</label><select :value="value.island" @change="emit('change', { island: ($event.target as HTMLSelectElement).value as Settings['island'] })"><option v-for="island in ISLANDS" :key="island.id" :value="island.id">{{ island.name }}</option></select></div>
    <div class="field"><label>额外金帮数量（已有＋额外最多 5 层）</label><input v-model.number="extra" type="number" min="0" max="5" step="1"></div>
    <template v-if="ex">
      <div class="field"><label>本周 EX 加成</label><select :value="value.exWeeklyBonus ?? 'none'" @change="emit('change', { exWeeklyBonus: ($event.target as HTMLSelectElement).value as Settings['exWeeklyBonus'] })"><option value="none">未设置</option><option value="berries">树果能量 ×2.4</option><option value="ingredients">普通帮忙食材 +1（食材型额外 50% 再 +1）</option><option value="skills">主技能发动率 ×1.25</option></select></div>
      <p>EX 主树果</p>
      <div class="picker-opts"><button v-for="berry in mainChoices" :key="berry.name" class="btn ghost" type="button" :class="{ on: value.berries[0] === berry.name }" @click="pickMain(berry.name)"><BerryIcon :name="berry.name" small />{{ berry.name }}</button></div>
      <p>副树果 {{ Math.max(0, value.berries.length - 1) }}/2</p>
      <div class="picker-opts"><button v-for="berry in secondary" :key="berry.name" class="btn ghost" type="button" :class="{ on: value.berries.slice(1).includes(berry.name) }" @click="toggle(berry.name)"><BerryIcon :name="berry.name" small />{{ berry.name }}</button></div>
      <label class="row"><input v-model="buff" type="checkbox">主树果 buff（帮忙速度、主技能等级 +1）</label>
      <label class="row"><input v-model="debuff" type="checkbox">非喜好树果 debuff（帮忙速度）</label>
    </template>
    <template v-else-if="canPickBerries(value.island)">
      <p>喜好树果 {{ value.berries.length }}/3</p>
      <div class="picker-opts"><button v-for="berry in BERRIES" :key="berry.name" class="btn ghost" type="button" :class="{ on: value.berries.includes(berry.name) }" @click="toggle(berry.name)"><BerryIcon :name="berry.name" small />{{ berry.name }}</button></div>
    </template>
    <p v-else class="muted">固定喜好：{{ value.berries.join('、') }}</p>
  </div>
</template>
