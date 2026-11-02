export const RESOURCE_ORIGIN = 'https://pokepokeshock.cn'
export type ResourceContext = 'prod' | 'test'
let context: ResourceContext = 'prod'
export function setResourceContext(value: ResourceContext) { context = value }
export function resourceContext() { return context }
export interface ResourceFile { path: string; bytes: number; sha256: string }
export interface ResourceManifest {
  schemaVersion: 1; contract: 'sleepast-data-v1'; clientMajor: 2; version: string
  data: ResourceFile; files: string[]; assets: Record<string, ResourceFile>
}
export interface ResourceSnapshot { manifest: ResourceManifest; data: Record<string, unknown> }
type ResourceGlobal = typeof globalThis & { __sleepastResources?: ResourceSnapshot }
export function installSnapshot(snapshot?: ResourceSnapshot) { (globalThis as ResourceGlobal).__sleepastResources = snapshot }
export function activeSnapshot() { return (globalThis as ResourceGlobal).__sleepastResources }
export function resourceRevision() { return activeSnapshot()?.manifest.data.sha256 ?? 'bundled' }
export function compatibleCheckpoint(value: { resourceRevision?: string }) { return (value.resourceRevision ?? 'bundled') === resourceRevision() }
export function resourceData<T>(name: string, bundled: T): T {
  const snapshot = activeSnapshot()
  return snapshot ? snapshot.data[name] as T : bundled
}
export function withResources<T>(request: T): T & { __sleepastResources?: ResourceSnapshot } {
  return { ...request, __sleepastResources: activeSnapshot() }
}
export function receiveResources(request: { __sleepastResources?: ResourceSnapshot }) { installSnapshot(request.__sleepastResources) }
export function remoteImage(file: string): string {
  const item = activeSnapshot()?.manifest.assets[file]
  return item ? RESOURCE_ORIGIN + item.path : ''
}
