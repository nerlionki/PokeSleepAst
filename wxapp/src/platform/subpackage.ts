// The native API remains supported, but is missing from current Tencent typings.
type PackageApi = { loadSubpackage(options: { name: string; success: () => void; fail: (error: unknown) => void }): unknown }
const loading = new Map<string, Promise<void>>()
export function loadAssetPackage(name: string): Promise<void> {
  if (!loading.has(name)) {
    loading.set(name, new Promise<void>((resolve, reject) => (wx as unknown as PackageApi).loadSubpackage({ name, success: resolve, fail: reject })).catch(error => { loading.delete(name); throw error }))
  }
  return loading.get(name)!
}
