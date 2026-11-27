import clientDefaults from '../data/client-defaults.resource'
import { computed, ref, shallowRef, watch, type Ref } from 'vue'
import { BERRIES, POKEDEX } from '../calc/data'
import { selectionList, matchesChoice } from '../calc/multiChoice'
import { pokeHit } from '../calc/pokeSearch'
import { compareDex } from '../calc/pokedexOrder'
import { SPECIALTY_FILTERS, specialtyHit } from '../calc/specialty'

type FilterPanel = 'none' | 'spec' | 'type' | 'sleep' | 'ing'
const defaults = clientDefaults.modules.components_shared_PokePicker

export interface PokemonPickerProps {
  allowedIds?: readonly number[]
  nameOverrides?: Record<number, string>
  title?: string
  editorTitle?: string
  dialogOnly?: boolean
}

export function usePokemonPicker(
  options: Pick<PokemonPickerProps, 'allowedIds' | 'dialogOnly'>,
  model: Readonly<Ref<number>>,
  select: (id: number) => void,
  hasEditor: () => boolean,
  onClose: () => void,
) {
  const allowed = computed(() => options.allowedIds ? new Set(options.allowedIds) : null)
  const open = shallowRef(options.dialogOnly || defaults.openInitial)
  const editing = shallowRef(false)
  const q = shallowRef(defaults["qInitial"])
  const panel = shallowRef<FilterPanel>(defaults.panelInitial as FilterPanel)
  const spec = ref(selectionList(defaults["specInitial"]))
  const type = ref(selectionList(defaults["typeInitial"]))
  const sleep = ref(selectionList(defaults["sleepInitial"]))
  const ing = ref(selectionList(defaults["ingInitial"]))

  const specs = ['全部', ...SPECIALTY_FILTERS]
  const types = computed(() => [...new Set(BERRIES.map((b) => b.type))])
  const sleeps = computed(() => [...new Set(POKEDEX.map((p) => p.sleepType))])

  const current = computed(() => POKEDEX.find((p) => p.id === model.value) ?? POKEDEX[0]!)

  const list = computed<(typeof POKEDEX)[number][]>((previous) => {
    const results = POKEDEX.filter((p) => {
      if (allowed.value && !allowed.value.has(p.id)) return false
      if (spec.value.length && !spec.value.some(value => specialtyHit(p.specialty, value))) return false
      if (!matchesChoice(type.value, p.berryType)) return false
      if (!matchesChoice(sleep.value, p.sleepType)) return false
      const ingredients = p.ingredients ?? []
      if (ing.value.length && !ingredients.some((x) => ing.value.includes(String(x.id)))) return false
      const extra = [p.berryType, p.berry, p.specialty, p.sleepType, ...ingredients.map((x) => x.name)].join(' ')
      return pokeHit(p, q.value, extra)
    }).sort(compareDex)
    return previous?.length === results.length && results.every((poke, index) => poke === previous[index])
      ? previous
      : results
  })

  function pick(id: number) {
    select(id)
    if (hasEditor()) {
      editing.value = true
      return
    }
    closePicker()
  }

  function closePicker() {
    open.value = false
    editing.value = false
    onClose()
  }

  function goBack() {
    if (editing.value) editing.value = false
    else closePicker()
  }

  function toggle(which: typeof panel.value) {
    panel.value = panel.value === which ? 'none' : which
  }

  function clearFilters() {
    spec.value = []
    type.value = []
    sleep.value = []
    ing.value = []
    q.value = ''
    panel.value = 'none'
  }

  const resultsRevision = shallowRef(0)
  // Keep the scroll container mounted when the parent refreshes eligible Pokémon.
  watch([q, spec, type, sleep, ing], () => { resultsRevision.value++ }, { deep: true })
  const filterOn = computed(() => Boolean(spec.value.length || type.value.length || sleep.value.length || ing.value.length))

  return {
    open, editing, current, q, panel, spec, type, sleep, ing, specs, types, sleeps,
    list, resultsRevision, filterOn, pick, closePicker, goBack, toggle, clearFilters
  }
}
