import Taro from '@tarojs/taro'
export async function loadJson<T>(key: string, fallback: T): Promise<T> {
  const keys = Taro.getStorageInfoSync().keys
  if (!keys.includes(key)) return fallback
  const value = Taro.getStorageSync(key)
  try { return JSON.parse(value) as T } catch { throw new Error('本机数据无法读取，请先导出备份，勿覆盖导入') }
}
export async function saveJson(key: string, value: unknown): Promise<void> {
  try { Taro.setStorageSync(key, JSON.stringify(value)) } catch { throw new Error('保存失败，请检查微信存储空间') }
}
export async function clearKey(key: string): Promise<void> { Taro.removeStorageSync(key) }
