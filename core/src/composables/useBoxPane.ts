import { t as translateUi } from '../ui/i18n';
import { editorMemberFields } from '../calc/memberPresets';
import { defaultSkillLevel, defaultTune } from '../calc/member';
import { confirmRemoval } from '#platform/confirm';
import clientDefaults from '../data/client-defaults.resource';
import { cloneData } from '../calc/dataClone';
import { computed, reactive, ref, shallowRef, watch } from 'vue';
import { resetPageScroll } from '#platform/pageScroll';
import type { ImportProgress } from '../calc/ocrImportCore';
import { useRoute, useRouter } from 'vue-router';
import {
    boxMatches,
    EMPTY_BOX_QUERY,
    filterCount,
    type BoxQuery
  } from '../calc/boxFilter';
import { selectionList } from '../calc/multiChoice';
import { NEUTRAL_NATURE, POKEDEX } from '../calc/data';
import { cloneMemberDraft } from '../calc/memberDraft';
import { importScreenshotSelection } from '#platform/screenshots';
import { useBoxStore } from '../stores/box';
import type { BoxPokemon, MemberTune, OcrMissingField } from '../types';
import { SPECIALTY_FILTERS } from '../calc/specialty';
import {
    confirmEditedOcrField,
    normalizeOcrMissing
  } from '../calc/ocrCompletion';

export function useBoxPane() {
  const components_pokemon_BoxPane_config_clientDefaults =
    clientDefaults.modules.components_pokemon_BoxPane;

  const TYPES = SPECIALTY_FILTERS;
  const sleepTypes = [...new Set(POKEDEX.map(poke => poke.sleepType))];

  const route = useRoute();
  const router = useRouter();
  const overviewOpen = computed(() => route.query.boxOverview === '1');
  function openOverview() {
    void router.push({
      path: route.path,
      query: { ...route.query, tab: 'box', boxOverview: '1' }
    });
  }
  function closeOverview() {
    const query = { ...route.query };
    delete query.boxOverview;
    if ('replace' in router && typeof router.replace === 'function')
      void router.replace({ path: route.path, query });
    else void router.push({ path: route.path, query });
  }
  function completeFromOverview(uids: string[]) {
    closeOverview();
    completionQueue.value = uids;
  }
  const box = useBoxStore();
  const picking = shallowRef(
    components_pokemon_BoxPane_config_clientDefaults['pickingInitial']
  );
  const ocrBusy = shallowRef(
    components_pokemon_BoxPane_config_clientDefaults['ocrBusyInitial']
  );
  const ocrMsg = shallowRef(
    components_pokemon_BoxPane_config_clientDefaults['ocrMsgInitial']
  );
  const ocrProgress = shallowRef<ImportProgress>(
    cloneData(
      components_pokemon_BoxPane_config_clientDefaults['ocrProgressInitial']
    ) as unknown as ImportProgress
  );
  const filterPanel = shallowRef<
    'none' | 'sleep' | 'berry' | 'skill' | 'advanced'
  >('none');
  const query = reactive<
    Omit<BoxQuery, 'berryType' | 'specialty' | 'mainSkill'> & {
      berryType: string[];
      specialty: string[];
      mainSkill: string[];
      sleepTypes: string[];
    }
  >({
    ...EMPTY_BOX_QUERY,
    berryType: selectionList(EMPTY_BOX_QUERY.berryType),
    specialty: selectionList(EMPTY_BOX_QUERY.specialty),
    mainSkill: selectionList(EMPTY_BOX_QUERY.mainSkill),
    sleepTypes: [],
    ingredients: [],
    subskills: []
  });
  watch(query, resetPageScroll);

  interface BoxDraft extends BoxPokemon {
    tune: MemberTune;
  }

  const editing = ref<BoxDraft | null>(
    components_pokemon_BoxPane_config_clientDefaults[
      'editingInitial'
    ] as unknown as BoxDraft | null
  );
  const completionQueue = shallowRef<string[]>(
    cloneData(
      components_pokemon_BoxPane_config_clientDefaults['completionQueueInitial']
    ) as unknown as string[]
  );
  const pendingOcr = computed(() =>
    box.pokemon.filter(
      pokemon => normalizeOcrMissing(pokemon.ocrMissing).length
    )
  );
  const completing = computed(() =>
    completionQueue.value
      .map(uid => box.pokemon.find(pokemon => pokemon.uid === uid))
      .find(
        pokemon => pokemon && normalizeOcrMissing(pokemon.ocrMissing).length
      )
  );

  function resumeCompletion(pokemon?: BoxPokemon) {
    completionQueue.value = pokemon
      ? [pokemon.uid]
      : pendingOcr.value.map(item => item.uid);
  }

  function persistCompletion(pokemon: BoxPokemon) {
    box.update(pokemon.uid, {
      ...pokemon,
      ocrMissing: pokemon.ocrMissing ?? []
    });
  }

  function saveCompletion(pokemon: BoxPokemon) {
    persistCompletion(pokemon);
    completionQueue.value = completionQueue.value.filter(
      uid => uid !== pokemon.uid
    );
  }

  function pauseCompletion(pokemon: BoxPokemon) {
    persistCompletion(pokemon);
    completionQueue.value = [];
  }

  async function removePokemon(uid: string) {
    if (await confirmRemoval('确认从盒子删除此宝可梦？')) box.remove(uid);
  }

  function blank(pokeId: number): BoxDraft {
    return {
      uid: '',
      pokeId,
      ...editorMemberFields(),
      nature: NEUTRAL_NATURE,
      skillLevel: defaultSkillLevel(pokeId),
      name: '',
      napping: false,
      tune: defaultTune(pokeId)
    };
  }

  async function pickShots() {
    if (ocrBusy.value) return;
    ocrProgress.value = {
      stage: '请选择截图',
      completed: 0,
      total: 0,
      percent: 0
    };
    ocrBusy.value = true;
    ocrMsg.value = '正在识别…';
    try {
      const result = await importScreenshotSelection(box.pokemon, value => {
        ocrProgress.value = value;
      });
      if (!result) {
        ocrMsg.value = '';
        return;
      }
      const imported = result.accepted.map(pokemon => box.create(pokemon));
      completionQueue.value = imported
        .filter(pokemon => normalizeOcrMissing(pokemon.ocrMissing).length)
        .map(pokemon => pokemon.uid);
      ocrMsg.value = translateUi(
        '写入 {accepted} 只，跳过 {skipped} 只，丢弃 {discarded} 只',
        {
          accepted: result.accepted.length,
          skipped: result.skipped,
          discarded: result.discarded
        }
      );
    } catch (cause) {
      ocrMsg.value =
        cause instanceof Error ? cause.message : '模型没有加载成功';
    } finally {
      ocrBusy.value = false;
    }
  }

  function pickSpecies(id: number) {
    picking.value = false;
    editing.value = blank(id);
  }

  function confirmEditingField(field: OcrMissingField) {
    if (editing.value)
      editing.value = confirmEditedOcrField(editing.value, field);
  }

  function openEdit(pokemon: BoxPokemon) {
    completionQueue.value = [];
    editing.value = cloneMemberDraft({
      ...pokemon,
      tune: { ...defaultTune(), ...pokemon.tune }
    });
  }

  function save() {
    const draft = editing.value;
    if (!draft) return;
    if (!draft.uid) box.create({ ...draft });
    else
      box.update(draft.uid, { ...draft, ocrMissing: draft.ocrMissing ?? [] });
    editing.value = null;
  }

  function clearFilters() {
    filterPanel.value = 'none';
    query.text = '';
    query.sleepTypes = [];
    query.berryType = [];
    query.specialty = [];
    query.mainSkill = [];
    query.ingredients = [];
    query.subskills = [];
    query.ingredientLock = 'unlocked';
    query.subskillLock = 'unlocked';
    query.subskillCombine = 'and';
  }

  const filtered = computed(() =>
    [...box.pokemon].reverse().filter(pokemon => boxMatches(pokemon, query))
  );
  const activeFilters = computed(() => filterCount(query));
  function toggleFilter(panel: typeof filterPanel.value) {
    filterPanel.value = filterPanel.value === panel ? 'none' : panel;
  }
  const advancedCount = computed(
    () =>
      Number(query.ingredients.length > 0) + Number(query.subskills.length > 0)
  );

  return {
    ocrBusy,
    ocrProgress,
    overviewOpen,
    closeOverview,
    completeFromOverview,
    openOverview,
    picking,
    pickShots,
    query,
    clearFilters,
    TYPES,
    filterPanel,
    toggleFilter,
    advancedCount,
    sleepTypes,
    filtered,
    box,
    activeFilters,
    ocrMsg,
    pendingOcr,
    resumeCompletion,
    openEdit,
    removePokemon,
    pickSpecies,
    editing,
    confirmEditingField,
    save,
    completing,
    completionQueue,
    saveCompletion,
    pauseCompletion,
  }
}
