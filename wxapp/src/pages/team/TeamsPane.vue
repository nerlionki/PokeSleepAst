<script setup lang="ts">
import UiIconButton from '../../generated/components/shared/UiIconButton.vue'
import { t as translateUi, teamName } from '../../../../core/src/ui/i18n';
import PokeSprite from '../../generated/components/shared/PokeSprite.vue';
import TeamRosterPane from '../../generated/components/team/TeamRosterPane.vue';
import TeamEditorFields from '../../generated/components/team/TeamEditorFields.vue'
import Dialog from '#platform/Dialog.vue'
import { useTeamsPane } from '../../../../core/src/composables/useTeamsPane'

const {
  editing,
  creating,
  create,
  save,
  teams,
  roster,
  member,
  navigate,
  removeTeam,
  team,
  cancel,
} = useTeamsPane()
</script>

<template>
  <view class="stack teams-pane">
    <template v-if="!editing">
      <div class="row">
        <h2>{{ translateUi('我的队伍') }}</h2>
        <button class="btn" type="button" aria-haspopup="dialog" @click="create">
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
        <div class="stack team-entry-actions">
          <button
            type="button"
            class="btn ghost"
            @click="navigate('detail', item.id)"
          >
            {{ translateUi('详情') }}
          </button>
          <button type="button" class="btn ghost rose" @click="removeTeam(item.id)">
            {{ translateUi('删除队伍') }}
          </button>
        </div>
      </article>
      <section
        v-if="!creating && teams.some(item => item.id === roster.activeTeamId)"
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
        <UiIconButton icon="back" :label="translateUi('返回队伍')" @click="cancel" />
        <h2>{{ translateUi('队伍详情') }}</h2>
      </div>
      <TeamEditorFields :team="team" />
      <button class="btn ghost" type="button" @click="removeTeam(team.id)">
        {{ translateUi('删除队伍') }}
      </button>
    </template>
    <Dialog v-if="creating && team" :title="translateUi('新建队伍')" @close="cancel">
      <TeamEditorFields :team="team" />
      <p v-if="roster.error" class="amber" role="alert">{{ translateUi(roster.error) }}</p>
      <template #footer>
        <button class="btn sage" type="button" @click="save">{{ translateUi('保存队伍') }}</button>
      </template>
    </Dialog>
    <p v-if="roster.error && !creating" class="amber" role="alert">
      {{ translateUi(roster.error) }}
    </p>
  </view>
</template>

<style>
  .teams-pane .team-entry {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
  }
  .teams-pane .team-entry.selected {
    outline: 2px solid var(--sage);
    outline-offset: -2px;
    background: var(--ink-2);
  }
  .teams-pane .team-select {
    flex: 1;
    min-width: 0;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--text);
    font: inherit;
    text-align: left;
  }
  .teams-pane .team-entry-actions {
    flex-shrink: 0;
  }
  .teams-pane .team-editor-header {
    flex-wrap: wrap;
  }
  .teams-pane .team-editor-header h2 {
    flex: 1;
    min-width: 0;
  }
  .teams-pane .team-entry .row {
    flex-wrap: wrap;
  }
</style>
