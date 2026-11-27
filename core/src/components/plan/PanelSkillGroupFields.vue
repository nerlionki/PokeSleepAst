<script setup lang="ts">
import { SUBSKILLS } from '../../calc/data'
import { SUBSKILL_GATES } from '../../calc/member'
import type { PanelSkillGroup } from '../../calc/panelProbability'
import { gameText, t } from '../../ui/i18n'
import SubskillIcon from '../shared/SubskillIcon.vue'

defineProps<{ group: PanelSkillGroup }>()
const slotChoices = SUBSKILL_GATES.map((level, slot) => ({ level, slot }))

function toggleSkill(list: string[], value: string) {
  const index = list.indexOf(value)
  if (index === -1) list.push(value)
  else list.splice(index, 1)
}
</script>

<template>
  <div class="stack">
    <div class="panel-grid">
      <label class="field">
        <span>{{ t('匹配条件') }}</span>
        <select v-model="group.mode">
          <option value="all">{{ t('全部满足') }}</option>
          <option value="minimum">{{ t('至少满足') }}</option>
          <option value="exclude">{{ t('全部排除') }}</option>
        </select>
      </label>
      <label v-if="group.mode === 'minimum'" class="field">
        <span>{{ t('最少数量') }}</span>
        <select v-model.number="group.minimum"><option v-for="(_, n) in SUBSKILL_GATES" :key="n" :value="n + 1">{{ n + 1 }}</option></select>
      </label>
      <label class="field">
        <span>{{ t('起始槽位') }}</span>
        <select v-model.number="group.fromSlot">
          <option v-for="{ level, slot } in slotChoices.slice(0, group.throughSlot + 1)" :key="level" :value="slot">Lv.{{ level }}</option>
        </select>
      </label>
      <label class="field">
        <span>{{ t('截止槽位') }}</span>
        <select v-model.number="group.throughSlot">
          <option v-for="{ level, slot } in slotChoices.slice(group.fromSlot)" :key="level" :value="slot">Lv.{{ level }}</option>
        </select>
      </label>
    </div>
    <div class="picker-opts panel-skill-tags">
      <button v-for="skill in SUBSKILLS" :key="skill.id" type="button" class="chip"
        :class="[`rarity-${skill.rarity}`, { on: group.skills.includes(skill.id) }]"
        :aria-pressed="group.skills.includes(skill.id)" @click="toggleSkill(group.skills, skill.id)">
        <SubskillIcon :id="skill.id" decorative />
        <span>{{ gameText(skill.name) }}</span>
        <span v-if="group.skills.includes(skill.id)" aria-hidden="true">×</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.panel-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr)); gap: .5rem; align-items: end; }
.panel-skill-tags button { gap: 6px; max-width: 100%; min-height: 40px; white-space: normal; text-align: left; }
.panel-skill-tags button.on.rarity-gold { background: var(--rarity-gold); color: var(--on-accent); }
.panel-skill-tags button.on.rarity-blue { background: var(--rarity-blue); color: var(--on-sage); }
.panel-skill-tags button.on.rarity-white { background: var(--text); color: var(--ink); }
</style>
