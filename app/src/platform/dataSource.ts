import { loadJson, saveJson } from './storage'
import { resourceContext, type ResourceContext } from '../../../core/src/resources/runtime'
export const canSwitchDataSource = import.meta.env.DEV || import.meta.env.VITE_APP_DEBUG === 'true'
export async function selectedDataSource(): Promise<ResourceContext> {
  return canSwitchDataSource && await loadJson('data-source', 'prod') === 'test' ? 'test' : 'prod'
}
export async function switchDataSource(context: ResourceContext) {
  if (!canSwitchDataSource || context === resourceContext()) return
  await saveJson('data-source', context)
  window.location.reload()
}
