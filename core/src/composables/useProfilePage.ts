import { shallowRef } from 'vue'
import { cloneData } from '../calc/dataClone'
import clientDefaults from '../data/client-defaults.resource'
import { usePageTab } from './usePageTab'

const profileTabs = ['home', 'backup', 'settings', 'recipe-levels', 'appearance', 'credits'] as const
const defaults = clientDefaults.modules.views_ProfileView

export function useProfilePage(platformTabs: readonly 'update'[] = []) {
  const tab = usePageTab([...profileTabs, ...platformTabs, 'features'] as const, 'home')
  const userInfo = shallowRef(defaults.userInfoInitial as unknown as { name: string; avatar?: string } | null)
  const titles = { ...cloneData(defaults.titles), features: '功能开关', 'recipe-levels': '食谱等级' }
  return { tab, userInfo, titles }
}
