import { confirmRemoval } from '#platform/confirm';
import { computed, onScopeDispose, shallowRef, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useRosterStore, type TeamCustom } from '../stores/roster';
import { useBoxStore } from '../stores/box';

export function useTeamsPane() {
  const route = useRoute();
  const router = useRouter();
  const roster = useRosterStore();
  const box = useBoxStore();
  const teams = computed(() => roster.teamList());
  const draftId = shallowRef('');
  const team = computed(() =>
    teams.value.find(item => item.id === (draftId.value || route.query.teamId))
  );
  const editing = computed(() =>
    Boolean(team.value && !draftId.value && route.query.teamPage === 'detail')
  );
  const creating = computed(() => Boolean(team.value && (draftId.value || route.query.teamPage === 'new')));
  const visibleTeams = computed(() =>
    creating.value ? teams.value.filter(item => item.id !== team.value?.id) : teams.value
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
    const target = {
      path: route.path,
      query: {
        ...query,
        tab: 'team',
        ...(page ? { teamPage: page, teamId: id } : {})
      }
    };
    if (!page && route.query.teamPage === 'new') void router.replace(target);
    else void router.push(target);
  }
  function create() {
    draftId.value = roster.beginTeamDraft();
  }
  function save() {
    if (draftId.value) {
      roster.finishTeamDraft(draftId.value, true);
      draftId.value = '';
    } else if (route.query.teamPage === 'new') navigate();
  }
  function member(id: string, customs: TeamCustom[]) {
    return (
      customs.find(item => item.uid === id) ??
      box.pokemon.find(item => item.uid === id)
    );
  }
  async function cancel() {
    if (draftId.value) {
      roster.finishTeamDraft(draftId.value, false);
      draftId.value = '';
      return;
    }
    if (route.query.teamPage === 'new' && team.value) {
      if (!(await confirmRemoval('确认取消新建并删除此队伍？'))) return;
      roster.deleteTeam(team.value.id);
    }
    navigate();
  }
  async function removeTeam(id: string) {
    if (!(await confirmRemoval('确认删除此队伍？'))) return;
    roster.deleteTeam(id);
    if (route.query.teamId === id) navigate();
  }
  onScopeDispose(() => {
    if (draftId.value) roster.finishTeamDraft(draftId.value, false);
  });

  return {
    editing,
    creating,
    create,
    save,
    teams: visibleTeams,
    roster,
    member,
    navigate,
    removeTeam,
    team,
    cancel,
  }
}
