import { usePageTab } from './usePageTab'

export const pokemonTabs = [
  { id: 'dex', label: '图鉴' },
  { id: 'box', label: 'Box' },
  { id: 'wall', label: '睡姿图鉴' },
] as const

export function usePokemonPage() {
  const tab = usePageTab(pokemonTabs.map(option => option.id), 'dex')
  return tab
}
