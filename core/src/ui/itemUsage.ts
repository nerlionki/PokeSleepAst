import { ANNOUNCED } from '../calc/announcedContent'
import { POKEDEX, pokeById } from '../calc/data'
import { pokemonUsingEvolutionItem } from '../calc/evolution'
import type { GameItem, PokemonItemId } from '../calc/itemCatalog'
import { gameLabel } from './gameLabels'
import { gameText, language, t } from './i18n'

type Item = GameItem<number | PokemonItemId>
const evolutionUsage = '用于满足指定宝可梦的进化条件。'
const biscuitUsage = '在点心时间喂给指定宝可梦，增加 6 点友情点数。'
const namedUsages = new Map([
  [evolutionUsage, '用于满足以下宝可梦的进化条件：{pokemon}。'],
  [biscuitUsage, '在点心时间喂给{pokemon}，增加 6 点友情点数。'],
  ['在下次睡眠研究至少出现对应宝可梦。', '在下次睡眠研究中至少会出现一只{pokemon}。'],
  ['使指定宝可梦的主技能提升一级。', '可使以下任一宝可梦的主技能提升一级：{pokemon}。'],
  ['用于解锁对应宝可梦的副技能或食材；梦幻也可用它解锁或切换主技能。', '用于解锁{pokemon}的副技能或食材；梦幻也可用它解锁或切换主技能。'],
  ['用来提升对应宝可梦的等级或满足进化条件。', '用来提升{pokemon}的等级或满足进化条件。'],
])

function itemPokemonIds(item: Item) {
  if (item.category === '进化道具' && typeof item.id === 'number') return pokemonUsingEvolutionItem(item.id)
  if (item.pokemonItem) return [item.pokemonItem.pokemonId]
  if (item.compatiblePokemonIds) return item.compatiblePokemonIds

  // Older snapshots identify the recipients of named biscuits in the item label.
  if (item.usage !== biscuitUsage) return []
  const names = item.name.replace(/沙布蕾$/, '').split(/[／/]/).map(name => gameLabel(name.trim()))
  const ids = names.flatMap(name => {
    const pokemon = POKEDEX.find(row => gameLabel(row.name) === name)
    return pokemon ? [pokemon.id] : []
  })
  return ids.length === names.length ? ids : []
}

export function itemPokemon(item: Item) {
  return itemPokemonIds(item).flatMap(id => {
    const announced = ANNOUNCED.pokemon.find(row => (row.runtimeId ?? row.nationalDex ?? row.imageId) === id)
    const name = pokeById(id)?.name ?? announced?.name
    return name ? [{ id: announced?.imageId ?? id, name }] : []
  })
}

export function itemUsage(item: Item, targets: ReturnType<typeof itemPokemon>) {
  const usage = item.usage ?? (item.category === '进化道具' ? evolutionUsage : '')
  const namedUsage = namedUsages.get(usage)
  if (!namedUsage || !targets.length) return t(usage)
  const pokemon = targets.map(target => gameText(target.name)).join(language.value === 'en' ? ', ' : '、')
  return t(namedUsage, { pokemon })
}
