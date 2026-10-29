import { loadJson, saveJson } from './storage'
import { resourceContext, type ResourceContext } from '../../../core/src/resources/runtime'
export const canSwitchDataSource = ['develop', 'trial'].includes(wx.getAccountInfoSync().miniProgram.envVersion)
export async function selectedDataSource(): Promise<ResourceContext> {
  return canSwitchDataSource && await loadJson('data-source', 'prod') === 'test' ? 'test' : 'prod'
}
export async function switchDataSource(context: ResourceContext) {
  if (!canSwitchDataSource || context === resourceContext()) return
  await saveJson('data-source', context)
  await new Promise<void>(resolve => {
    const manualRestart = () => wx.showModal({ title: '数据源已保存', content: '请关闭并重新打开小程序，加载所选网络数据源。', showCancel: false, complete: () => resolve() })
    // restartMiniProgram starts at base library 3.0.1; the app supports 2.27.3.
    if (typeof wx.restartMiniProgram === 'function') wx.restartMiniProgram({ path: '/pages/profile/index', success: () => resolve(), fail: manualRestart })
    else manualRestart()
  })
}
