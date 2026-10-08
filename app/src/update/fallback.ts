import { assetUrl, REPOSITORY, validateUpdate, type AvailableUpdate, type GitHubRelease, type UpdateManifest } from './release'
import { requestJson } from './request'
import { versionCode } from './version'
export const LATEST_MANIFEST = 'https://github.com/' + REPOSITORY + '/releases/latest/download/update.json'

/** Official Release assets work independently of the anonymous GitHub API quota. */
export async function fallbackUpdate(): Promise<AvailableUpdate> {
  const raw = await requestJson(LATEST_MANIFEST) as Partial<UpdateManifest> | null
  if (!raw || typeof raw.version !== 'string') throw new Error('发布版本信息不完整，请稍后重试')
  versionCode(raw.version)
  const tags = raw.version.split('.').length === 4 ? [raw.version + '_hotfix', 'v' + raw.version] : ['v' + raw.version]
  for (const tag of tags) {
    // Resolve a real, version-specific manifest; never accept arbitrary manifest URLs.
    const pinned = await requestJson(assetUrl(tag, 'update.json'), true) as Partial<UpdateManifest> | null
    if (!pinned) continue
    const release: GitHubRelease = { tag_name: tag, draft: false, prerelease: false, body: '',
      assets: [{ name: pinned.fileName ?? '', size: Number(pinned.size), state: 'uploaded', browser_download_url: assetUrl(tag, pinned.fileName ?? '') }] }
    return validateUpdate(release, pinned)
  }
  throw new Error('最新版本尚未提供完整的 Android 更新产物，请稍后重试')
}
