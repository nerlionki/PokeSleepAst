<script setup lang="ts">
import { t } from '../../ui/i18n'
import { useRosterStore, type SavedTeam } from '../../stores/roster'
import TeamRosterPane from './TeamRosterPane.vue'

defineProps<{ team: SavedTeam }>()
const roster = useRosterStore()
</script>

<template>
  <div class="stack">
    <label class="field">
      <span>{{ t('队伍名称') }}</span>
      <input :value="team.name" maxlength="30"
        @change="roster.renameTeam(team.id, ($event.target as HTMLInputElement).value)" />
    </label>
    <TeamRosterPane :key="team.id" editor-only />
  </div>
</template>
