import policy from '../../config/compatibility.json'
export const MIN_MINIPROGRAM_VERSION = policy.minimumMiniProgramVersion
export const MIN_BASE_LIBRARY_VERSION = policy.minimumBaseLibraryVersion
export function versionAtLeast(actual: string, required: string): boolean {
  if (!/^\d+(?:\.\d+)*$/.test(actual)) return false
  const a = actual.split('.').map(Number), b = required.split('.').map(Number)
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0)
  }
  return true
}
export function requireWorkerSupport(): void {
  const info = typeof wx.getAppBaseInfo === 'function' ? wx.getAppBaseInfo() : wx.getSystemInfoSync()
  if (!versionAtLeast(info.SDKVersion, MIN_BASE_LIBRARY_VERSION)) {
    throw new Error('请升级微信后重试，后台计算需要基础库 ' + MIN_BASE_LIBRARY_VERSION + ' 或以上')
  }
  const account = typeof wx.getAccountInfoSync === 'function' ? wx.getAccountInfoSync().miniProgram : null
  if (account?.envVersion === 'release' && !versionAtLeast(account.version, MIN_MINIPROGRAM_VERSION)) {
    throw new Error('请更新小程序至 ' + MIN_MINIPROGRAM_VERSION + ' 或以上后重试')
  }
  if (typeof wx.preDownloadSubpackage !== 'function' || typeof wx.createWorker !== 'function') {
    throw new Error('当前微信环境不支持后台计算，请更新微信或在真机中重试')
  }
}
