export type ActivityBonusRef =
  | { kind: 'field'; id: string }
  | { kind: 'text'; value: string }
  | { kind: 'type'; id: string }
  | { kind: 'specialty'; id: string }
  | { kind: 'skill'; id: number }
  | { kind: 'skillFamily'; id: string }
  | { kind: 'pokemon'; id: number }
  | { kind: 'ingredient'; id: number | string }
  | { kind: 'team'; ids: number[] }

export interface ActivityBonusPart {
  kind: 'multiply' | 'add' | 'limit' | 'text' | 'mix' | 'category'
  value?: number | string
  text?: string
}

export interface ActivityBonusItem {
  ref: ActivityBonusRef
  parts: ActivityBonusPart[]
  scope?: ActivityBonusRef[]
  startsOn?: string
  endsOn?: string
}

export interface ActivityBonusGroup {
  id: 'energy' | 'candy' | 'research' | 'sleep' | 'ingredient' | 'helper'
  items: ActivityBonusItem[]
}

export interface ActivityBonusArea {
  area: string[]
  groups: ActivityBonusGroup[]
}

export interface ActivityBerryItem {
  island: string
  berries: number[]
  scope?: ActivityBonusRef[]
}

export interface ActivityAnnouncement {
  id: string
  name: string
  announcedOn: string | null
  startsOn: string
  endsOn: string
  source: string
  bonusSections?: { title: string; lines: string[] }[]
  bonusGroups?: ActivityBonusArea[]
  berryGroup?: { items: ActivityBerryItem[] }
  notes?: string[]
}

export interface ActivityEncounterUp {
  tier?: 'large' | 'medium' | 'small' | 'special'
  pokemonIds: number[]
  islands?: string[]
  label?: string
}

export interface ActivityArchive {
  schemaVersion: 1
  events: ActivityAnnouncement[]
  encounterUps?: Record<string, ActivityEncounterUp[]>
}

const bonusGroups = new Set(['energy', 'candy', 'research', 'sleep', 'ingredient', 'helper'])
const bonusFields = new Set(['drowsyPowerMultiplier', 'sleepExpMultiplier', 'researchCandyMultiplier', 'eventMix', 'dreamShardsMultiplier', 'skillRateMultiplier', 'ingredientCountBonus', 'skillLevelBonus', 'cookingEnergyMultiplier', 'potSizeMultiplier', 'mealRecoveryBonus', 'berryCountBonus', 'skillIngredientMultiplier', 'researchExpMultiplier', 'skillDreamShardsMultiplier', 'carryCapacityBonus', 'carryCapacityMultiplier', 'potCapacityBonus', 'berryEnergyMultiplier', 'helpIntervalMultiplier', 'mealRecoveryMultiplier', 'skillBerryMultiplier', 'skillHealingMultiplier', 'skillStrengthMultiplier'])

function validBonus(event: ActivityAnnouncement, data: Record<string, unknown> | undefined, date: (value: string) => boolean) {
  const text = (value: unknown) => typeof value === 'string' && !!value.trim()
  const islands = data?.['islands.json'] as { id: string }[] | undefined
  const berries = data?.['berries.json'] as { id: number }[] | undefined
  const ingredients = data?.['ingredients.json'] as { id: number }[] | undefined
  const skills = (data?.['skill-tables.json'] as { modules?: { mainSkills?: { MAIN_SKILLS?: { id: number }[] } } } | undefined)?.modules?.mainSkills?.MAIN_SKILLS
  const pokemon = data?.['pokedex.json'] as { id: number }[] | undefined
  const announced = data?.['meta.json'] as { announcedContent?: { pokemon?: { imageId?: number }[]; ingredients?: { key?: string }[] } } | undefined
  const pokemonIds = new Set([...(pokemon ?? []).map(row => row.id), ...(announced?.announcedContent?.pokemon ?? []).map(row => row.imageId)])
  const ingredientKeys = new Set((announced?.announcedContent?.ingredients ?? []).map(row => row.key))
  const known = (id: number, rows?: { id: number }[]) => !data || !!rows?.some(row => row.id === id)
  const refOk = (ref: { kind?: string; id?: unknown; value?: unknown; ids?: unknown } | undefined): boolean => {
    if (!ref) return false
    if (ref.kind === 'field') return typeof ref.id === 'string' && bonusFields.has(ref.id)
    if (ref.kind === 'text') return text(ref.value)
    if (ref.kind === 'type' || ref.kind === 'specialty' || ref.kind === 'skillFamily') return text(ref.id)
    if (ref.kind === 'skill') return Number.isSafeInteger(ref.id) && known(ref.id as number, skills)
    if (ref.kind === 'pokemon') return Number.isSafeInteger(ref.id) && (ref.id as number) > 0 && (!data || pokemonIds.has(ref.id as number))
    if (ref.kind === 'ingredient') return Number.isSafeInteger(ref.id) && known(ref.id as number, ingredients) || typeof ref.id === 'string' && (!data || ingredientKeys.has(ref.id))
    if (ref.kind === 'team') return Array.isArray(ref.ids) && ref.ids.length > 0 && ref.ids.every(id => Number.isSafeInteger(id) && id > 0 && (!data || pokemonIds.has(id)))
    return false
  }
  const partOk = (part: { kind?: string; value?: unknown; text?: unknown }) => {
    if (!part) return false
    if (part.kind === 'multiply' || part.kind === 'add' || part.kind === 'limit') return typeof part.value === 'number' && Number.isFinite(part.value) && (part.text === undefined || text(part.text))
    if (part.kind === 'text') return text(part.value)
    if (part.kind === 'mix') return part.value === 'some' || part.value === 'all'
    if (part.kind === 'category') return part.value === 'curry' || part.value === 'salad' || part.value === 'dessert'
    return false
  }
  const scopeOk = (scope: unknown) => scope === undefined || Array.isArray(scope) && scope.every(refOk)
  const itemOk = (item: unknown): boolean => {
    if (!item || typeof item !== 'object') return false
    const row = item as { ref?: { kind?: string; id?: unknown; value?: unknown; ids?: unknown }; parts?: { kind?: string; value?: unknown; text?: unknown }[]; scope?: unknown; startsOn?: string; endsOn?: string }
    return refOk(row.ref) && Array.isArray(row.parts) && row.parts.length > 0 && row.parts.every(partOk) && scopeOk(row.scope)
      && (row.startsOn === undefined && row.endsOn === undefined || !!row.startsOn && !!row.endsOn && date(row.startsOn) && date(row.endsOn) && row.startsOn < row.endsOn)
  }
  if (event.bonusGroups !== undefined && (!Array.isArray(event.bonusGroups) || !event.bonusGroups.every((block: { area?: unknown; groups?: { id?: string; items?: unknown[] }[] }) => block && Array.isArray(block.area)
    && block.area.every((id: unknown) => typeof id === 'string' && (!data || islands?.some(row => row.id === id))) && new Set(block.area).size === block.area.length
    && Array.isArray(block.groups) && block.groups.length > 0 && new Set(block.groups.map(group => group?.id)).size === block.groups.length
    && block.groups.every(group => group && bonusGroups.has(group.id ?? '') && Array.isArray(group.items) && group.items.length > 0 && group.items.every(itemOk))))) return false
  const berriesOk = (ids: unknown) => Array.isArray(ids) && ids.length > 0 && ids.every(id => Number.isSafeInteger(id) && (id as number) > 0 && known(id as number, berries))
  if (event.berryGroup !== undefined && (!event.berryGroup || !Array.isArray(event.berryGroup.items) || !event.berryGroup.items.length
    || !event.berryGroup.items.every((item: { island?: unknown; berries?: unknown; scope?: unknown }) => item && typeof item.island === 'string' && (!data || islands?.some(row => row.id === item.island)) && berriesOk(item.berries) && scopeOk(item.scope)))) return false
  if (event.notes !== undefined && (!Array.isArray(event.notes) || !event.notes.length || !event.notes.every(text))) return false
  return true
}

export function validateActivityArchive(value: unknown, data?: Record<string, unknown>): asserts value is ActivityArchive {
  const archive = value as ActivityArchive | null
  const date = (s: string) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)
    && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s
  const ids = new Set<string>()
  if (!archive || archive.schemaVersion !== 1 || !Array.isArray(archive.events)
    || !archive.events.every(event => {
      if (!event || typeof event.id !== 'string' || !/^[a-z0-9-]+$/.test(event.id) || ids.has(event.id)
        || typeof event.name !== 'string' || !event.name.trim() || event.announcedOn !== null && !date(event.announcedOn)
        || !date(event.startsOn) || !date(event.endsOn) || event.startsOn >= event.endsOn
        || typeof event.source !== 'string' || !/^(?:(?:https:\/\/web\.archive\.org\/web\/\d+\/)?https:\/\/www\.pokemonsleep\.net\/(?:zh\/|en\/)?news\/\d+_?\/|https:\/\/www\.serebii\.net\/pokemonsleep\/events\/[a-z0-9.-]+\.shtml)$/.test(event.source)) return false
      ids.add(event.id)
      if (event.bonusSections !== undefined && (!Array.isArray(event.bonusSections) || !event.bonusSections.every(section =>
        section && typeof section.title === 'string' && section.title.trim() && Array.isArray(section.lines)
        && section.lines.length > 0 && section.lines.every(line => typeof line === 'string' && line.trim())))) return false
      if (!validBonus(event, data, date)) return false
      return true
    })) throw Error('历史活动公告资料无效')
  if (archive.encounterUps !== undefined) {
    const pokemon = data?.['pokedex.json'] as { id: number }[] | undefined
    const islands = data?.['islands.json'] as { id: string }[] | undefined
    const active = data?.['activities.json'] as { activities?: { id: string }[] } | undefined
    const announced = data?.['meta.json'] as { announcedContent?: { pokemon?: { imageId?: number }[] } } | undefined
    const pokemonIds = new Set([...(pokemon ?? []).map(row => row.id), ...(announced?.announcedContent?.pokemon ?? []).map(row => row.imageId)])
    if (!archive.encounterUps || Array.isArray(archive.encounterUps) || typeof archive.encounterUps !== 'object'
      || !Object.entries(archive.encounterUps).every(([id, groups]) => /^[a-z0-9-]+$/.test(id) && Array.isArray(groups)
        && (!data || ids.has(id) || active?.activities?.some(event => event.id === id))
        && groups.length > 0 && groups.every(group => group && (group.tier === undefined || ['large', 'medium', 'small', 'special'].includes(group.tier))
          && Array.isArray(group.pokemonIds) && group.pokemonIds.length > 0 && new Set(group.pokemonIds).size === group.pokemonIds.length
          && group.pokemonIds.every(id => Number.isSafeInteger(id) && id > 0 && (!data || pokemonIds.has(id)))
          && (group.islands === undefined || Array.isArray(group.islands) && group.islands.length > 0
            && group.islands.every(id => typeof id === 'string' && (!data || islands?.some(row => row.id === id))))
          && (group.label === undefined || typeof group.label === 'string' && group.label.trim())))) throw Error('活动出没提升资料无效')
  }
}
