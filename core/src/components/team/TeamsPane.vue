<script setup lang="ts">
  import { t as translateUi, teamName } from '../../ui/i18n';
  import { confirmRemoval } from '#platform/confirm';
  import { computed, watch } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import { useRosterStore, type TeamCustom } from '../../stores/roster';
  import { useBoxStore } from '../../stores/box';
  import PokeSprite from '../shared/PokeSprite.vue';
  import TeamRosterPane from './TeamRosterPane.vue';
  const route = useRoute();
  const router = useRouter();
  const roster = useRosterStore();
  const box = useBoxStore();
  const teams = computed(() => roster.teamList());
  const team = computed(() =>
    teams.value.find(item => item.id === route.query.teamId)
  );
  const editing = computed(() =>
    Boolean(
      team.value && ['new', 'detail'].includes(String(route.query.teamPage))
    )
  );
  watch(
    () => [route.query.teamId, roster.ready] as const,
    ([id]) => {
      if (typeof id === 'string') roster.selectTeam(id);
    },
    { immediate: true }
  );
  function navigate(page?: string, id?: string) {
    const { teamPage: _page, teamId: _id, ...query } = route.query;
    void router.push({
      path: route.path,
      query: {
        ...query,
        tab: 'team',
        ...(page ? { teamPage: page, teamId: id } : {})
      }
    });
  }
  function create() {
    const id = roster.createTeam();
    navigate('new', id);
  }
  function member(id: string, customs: TeamCustom[]) {
    return (
      customs.find(item => item.uid === id) ??
      box.pokemon.find(item => item.uid === id)
    );
  }
  async function cancel() {
    if (route.query.teamPage === 'new' && team.value) {
      if (!(await confirmRemoval('确认取消新建并删除此队伍？'))) return;
      roster.deleteTeam(team.value.id);
    }
    navigate();
  }
  async function removeTeam(id: string) {
    if (!(await confirmRemoval('确认删除此队伍？'))) return;
    roster.deleteTeam(id);
    navigate();
  }
</script>
<template>
  <div class="stack">
    <template v-if="!editing">
      <div class="row">
        <h2>{{ translateUi('我的队伍') }}</h2>
        <button class="btn" type="button" @click="create">
          {{ translateUi('新建队伍') }}
        </button>
      </div>
      <p v-if="!teams.length" class="muted">
        {{ translateUi('还没有队伍，先从盒子选择或添加自定义宝可梦。') }}
      </p>
      <article
        v-for="item in teams"
        :key="item.id"
        class="card team-entry"
        :class="{ selected: roster.activeTeamId === item.id }"
      >
        <button
          type="button"
          class="team-select stack"
          :aria-pressed="roster.activeTeamId === item.id"
          @click="roster.selectTeam(item.id)"
        >
          <strong>{{ teamName(item.name) }}</strong>
          <div class="row">
            <template v-for="(uid, index) in item.slots" :key="index">
              <PokeSprite
                v-if="uid && member(uid, item.customs)"
                :id="member(uid, item.customs)!.pokeId"
                :ribbon-hours="
                  member(uid, item.customs)?.tune?.ribbonHours ??
                  item.tunes[uid]?.ribbonHours
                "
              />
              <span v-else class="muted">{{ translateUi('空位') }}</span>
            </template>
          </div>
          <span class="muted">{{
            roster.activeTeamId === item.id
              ? translateUi('已选中')
              : translateUi('点击计算本队产量')
          }}</span>
        </button>
        <button
          type="button"
          class="btn ghost team-details"
          @click="navigate('detail', item.id)"
        >
          {{ translateUi('详情') }}
        </button>
      </article>
      <section
        v-if="teams.some(item => item.id === roster.activeTeamId)"
        class="stack"
        :aria-label="translateUi('选中队伍产量')"
      >
        <h3>
          {{
            teamName(
              teams.find(item => item.id === roster.activeTeamId)?.name ?? ''
            )
          }}
          {{ translateUi('· 产量') }}
        </h3>
        <TeamRosterPane :key="roster.activeTeamId" production-only />
      </section>
    </template>
    <template v-else-if="team">
      <div class="row team-editor-header">
        <button class="btn ghost" type="button" @click="cancel">
          {{
            route.query.teamPage === 'new'
              ? translateUi('取消新建')
              : translateUi('返回队伍')
          }}
        </button>
        <h2>
          {{
            route.query.teamPage === 'new'
              ? translateUi('新建队伍')
              : translateUi('队伍详情')
          }}
        </h2>
        <button
          v-if="route.query.teamPage === 'new'"
          class="btn"
          type="button"
          @click="navigate()"
        >
          {{ translateUi('保存队伍') }}
        </button>
      </div>
      <label class="field"
        ><span>{{ translateUi('队伍名称') }}</span
        ><input
          :value="team.name"
          maxlength="30"
          @change="
            roster.renameTeam(
              team.id,
              ($event.target as HTMLInputElement).value
            )
          "
      /></label>
      <TeamRosterPane :key="team.id" editor-only />
      <button
        v-if="route.query.teamPage !== 'new'"
        class="btn ghost"
        type="button"
        @click="removeTeam(team.id)"
      >
        {{ translateUi('删除队伍') }}
      </button>
    </template>
    <p v-if="roster.error" class="amber" role="alert">
      {{ translateUi(roster.error) }}
    </p>
  </div>
</template>
<style scoped>
  .team-entry {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
  }
  .team-entry.selected {
    outline: 2px solid var(--sage);
    outline-offset: -2px;
    background: var(--ink-2);
  }
  .team-select {
    flex: 1;
    min-width: 0;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--text);
    font: inherit;
    text-align: left;
  }
  .team-details {
    flex-shrink: 0;
  }
  .team-editor-header {
    flex-wrap: wrap;
  }
  .team-editor-header h2 {
    flex: 1;
    min-width: 0;
  }
  .team-entry .row {
    flex-wrap: wrap;
  }
</style>
