import { versionCode } from './version'

export const REPOSITORY = 'nerlionki/PokeSleepAst'
export const LATEST_RELEASE_API = `https://api.github.com/repos/${REPOSITORY}/releases/latest`

export interface ReleaseAsset {
  name: string
  size: number
  browser_download_url: string
  state: string
}

export interface GitHubRelease {
  tag_name: string
  draft: boolean
  prerelease: boolean
  body: string | null
  assets: ReleaseAsset[]
}

export interface UpdateManifest {
  version: string
  versionCode: number
  fileName: string
  size: number
  sha256: string
}

export interface AvailableUpdate extends UpdateManifest {
  url: string
  notes: string
}

export interface ReminderState {
  skippedVersion?: string
  promptedVersion?: string
  promptedDate?: string
}

export function releaseVersion(release: GitHubRelease): string | null {
  if (release.draft || release.prerelease) return null
  const version = release.tag_name?.match(/^v(.+)$/)?.[1]
  if (!version) return null
  try { versionCode(version) } catch { return null }
  return version
}

export function assetUrl(tag: string, name: string): string {
  return `https://github.com/${REPOSITORY}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(name)}`
}

export function manifestAsset(release: GitHubRelease): ReleaseAsset | undefined {
  return release.assets?.find((asset) => asset.name === 'update.json' && asset.state === 'uploaded'
    && asset.browser_download_url === assetUrl(release.tag_name, 'update.json'))
}

export function validateUpdate(release: GitHubRelease, raw: unknown): AvailableUpdate {
  const version = releaseVersion(release)
  const manifest = raw as Partial<UpdateManifest> | null
  if (!version || !manifest || manifest.version !== version || manifest.versionCode !== versionCode(version)
    || manifest.fileName !== `PokeSleepAst-${version}.apk`
    || !Number.isSafeInteger(manifest.size) || Number(manifest.size) <= 0
    || typeof manifest.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(manifest.sha256)) {
    throw new Error('发布版本信息不完整或不一致，请稍后重试')
  }
  const file = release.assets?.find((asset) => asset.name === manifest.fileName && asset.state === 'uploaded')
  if (!file || file.size !== manifest.size || file.browser_download_url !== assetUrl(release.tag_name, file.name)) {
    throw new Error('没有找到有效的 Android 安装包')
  }
  return { ...manifest as UpdateManifest, url: file.browser_download_url, notes: release.body ?? '' }
}

export function localDate(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export function shouldPrompt(state: ReminderState, version: string, date: string): boolean {
  return state.skippedVersion !== version && !(state.promptedVersion === version && state.promptedDate === date)
}
