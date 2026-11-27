import { usePageTab } from './usePageTab'
import { shallowRef } from 'vue'
import clientDefaults from '../data/client-defaults.resource'
import { useSettingsStore } from '../stores/settings'

export const teamTabs = [
  { id: 'team', label: '我的队伍' },
  { id: 'cmp', label: '个体对比' },
  { id: 'meal', label: '料理规划' },
] as const

export function useTeamPage() {
  const tab = usePageTab(teamTabs.map(option => option.id), 'team')
  const adjusting = shallowRef(clientDefaults.modules.views_TeamView.adjustingInitial)
  const settingsStore = useSettingsStore()
  return { tab, adjusting, settingsStore }
}
