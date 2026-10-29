<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useRosterStore } from '../../stores/roster'
import { useBoxStore } from '../../stores/box'
import PokeSprite from '../shared/PokeSprite.vue'
import TeamRosterPane from './TeamRosterPane.vue'
const route = useRoute()
const router = useRouter()
const roster = useRosterStore()
const box = useBoxStore()
const teams = computed(() => roster.teamList())
const team = computed(() => teams.value.find(item => item.id === route.query.teamId))
const editing = computed(() => Boolean(team.value && ['new', 'detail'].includes(String(route.query.teamPage))))
watch(() => [route.query.teamId, roster.ready] as const, ([id]) => { if (typeof id === 'string') roster.selectTeam(id) }, { immediate: true })
function navigate(page?: string, id?: string) {
  const { teamPage: _page, teamId: _id, ...query } = route.query
  void router.push({ path: route.path, query: { ...query, tab: 'team', ...(page ? { teamPage: page, teamId: id } : {}) } })
}
function create() { const id = roster.createTeam(); navigate('new', id) }
function member(id: string, customs: { uid: string; pokeId: number }[]) { return customs.find(item => item.uid === id) ?? box.pokemon.find(item => item.uid === id) }
function cancel() { if (route.query.teamPage === 'new' && team.value) roster.deleteTeam(team.value.id); navigate() }
</script>
<template>
  <div class="stack">
    <template v-if="!editing">
      <div class="row"><h2>我的队伍</h2><button class="btn" type="button" @click="create">新建队伍</button></div>
      <p v-if="!teams.length" class="muted">还没有队伍，先从盒子选择或添加自定义宝可梦。</p>
      <article v-for="item in teams" :key="item.id" class="card team-entry" :class="{ selected: roster.activeTeamId === item.id }">
        <button type="button" class="team-select stack" :aria-pressed="roster.activeTeamId === item.id" @click="roster.selectTeam(item.id)">
          <strong>{{ item.name }}</strong>
          <div class="row">
            <template v-for="(uid, index) in item.slots" :key="index">
              <PokeSprite v-if="uid && member(uid, item.customs)" :id="member(uid, item.customs)!.pokeId" />
              <span v-else class="muted">空位</span>
            </template>
          </div>
          <span class="muted">{{ roster.activeTeamId === item.id ? '已选中' : '点击计算本队产量' }}</span>
        </button>
        <button type="button" class="btn ghost team-details" @click="navigate('detail', item.id)">详情</button>
      </article>
      <section v-if="teams.some(item => item.id === roster.activeTeamId)" class="stack" aria-label="选中队伍产量">
        <h3>{{ teams.find(item => item.id === roster.activeTeamId)?.name }} · 产量</h3>
        <TeamRosterPane :key="roster.activeTeamId" production-only />
      </section>
    </template>
    <template v-else-if="team">
      <div class="row team-editor-header">
        <button class="btn ghost" type="button" @click="cancel">{{ route.query.teamPage === 'new' ? '取消新建' : '返回队伍' }}</button>
        <h2>{{ route.query.teamPage === 'new' ? '新建队伍' : '队伍详情' }}</h2>
        <button v-if="route.query.teamPage === 'new'" class="btn" type="button" @click="navigate()">保存队伍</button>
      </div>
      <label class="field"><span>队伍名称</span><input :value="team.name" maxlength="30" @change="roster.renameTeam(team.id, ($event.target as HTMLInputElement).value)"></label>
      <TeamRosterPane :key="team.id" editor-only />
      <button v-if="route.query.teamPage !== 'new'" class="btn ghost" type="button" @click="roster.deleteTeam(team.id); navigate()">删除队伍</button>
    </template>
    <p v-if="roster.error" class="amber" role="alert">{{ roster.error }}</p>
  </div>
</template>
<style scoped>
.team-entry { display: flex; align-items: center; gap: 12px; width: 100%; }
.team-entry.selected { outline: 2px solid var(--sage); outline-offset: -2px; background: var(--ink-2); }
.team-select { flex: 1; min-width: 0; padding: 0; border: 0; background: transparent; color: var(--text); font: inherit; text-align: left; }
.team-details { flex-shrink: 0; }
.team-editor-header { flex-wrap: wrap; }
.team-editor-header h2 { flex: 1; min-width: 0; }
.team-entry .row { flex-wrap: wrap; }
</style>
