import { describe, expect, it } from 'vitest'
import { assetUrl, localDate, manifestAsset, releaseVersion, shouldPrompt, validateUpdate, type GitHubRelease } from './release'
import { versionCode, buildVersionCode, compareVersions, iosMarketingVersion } from './version'

const manifest = { version: '1.2.3', versionCode: 1002003, fileName: 'PokeSleepAst-1.2.3.apk', size: 1234, sha256: 'a'.repeat(64) }
const release: GitHubRelease = {
  tag_name: 'v1.2.3', draft: false, prerelease: false, body: '更新说明',
  assets: [
    { name: 'update.json', size: 200, state: 'uploaded', browser_download_url: assetUrl('v1.2.3', 'update.json') },
    { name: manifest.fileName, size: manifest.size, state: 'uploaded', browser_download_url: assetUrl('v1.2.3', manifest.fileName) },
  ],
}

describe('release validation', () => {
  it('orders hotfixes between patches and creates increasing native build codes', () => {
    expect(compareVersions('1.0.2.1', '1.0.2')).toBeGreaterThan(0)
    expect(compareVersions('1.0.3', '1.0.2.99')).toBeGreaterThan(0)
    expect(buildVersionCode('1.0.2.1')).toBe(100000201)
    expect(buildVersionCode('1.0.3')).toBeGreaterThan(buildVersionCode('1.0.2.99'))
    expect(iosMarketingVersion('1.0.2.1')).toBe('1.0.2')
    for (const invalid of ['1.0.2.100', '1.0.2.01', '1.0.2.1.2']) expect(() => buildVersionCode(invalid)).toThrow()
  })
  it('binds a hotfix release to its numeric version and exact asset URLs', () => {
    const tag = '1.0.2.1_hotfix'
    const hotfixManifest = { ...manifest, version: '1.0.2.1', versionCode: 100000201, fileName: 'PokeSleepAst-1.0.2.1.apk' }
    const hotfix = { ...release, tag_name: tag, assets: [
      { ...release.assets[0]!, browser_download_url: assetUrl(tag, 'update.json') },
      { ...release.assets[1]!, name: hotfixManifest.fileName, browser_download_url: assetUrl(tag, hotfixManifest.fileName) },
    ] }
    expect(releaseVersion(hotfix)).toBe('1.0.2.1')
    expect(validateUpdate(hotfix, hotfixManifest).url).toBe(assetUrl(tag, hotfixManifest.fileName))
    expect(() => validateUpdate(hotfix, { ...hotfixManifest, versionCode: 1000002 })).toThrow()
    expect(() => validateUpdate({ ...hotfix, assets: hotfix.assets.map(a => ({ ...a, browser_download_url: a.browser_download_url.replace(tag, 'v1.0.2.1') })) }, hotfixManifest)).toThrow()
  })
  it('compares multi digit versions and respects Android version code bounds', () => {
    expect(versionCode('1.10.0')).toBeGreaterThan(versionCode('1.9.999'))
    expect(versionCode('2.0.0')).toBeGreaterThan(versionCode('1.999.999'))
    expect(versionCode('2099.999.999')).toBeLessThan(2100000000)
    for (const value of ['1.0', '01.0.0', '1.0.0-beta', '2100.0.0', '1.1000.0', '0.0.0']) {
      expect(() => versionCode(value)).toThrow()
    }
  })
  it('ignores draft, prerelease and unsupported tags', () => {
    expect(releaseVersion(release)).toBe('1.2.3')
    expect(releaseVersion({ ...release, draft: true })).toBeNull()
    expect(releaseVersion({ ...release, prerelease: true })).toBeNull()
    expect(releaseVersion({ ...release, tag_name: 'v1.2.3-beta' })).toBeNull()
  })
  it('binds manifest and APK to the exact release and repository', () => {
    expect(manifestAsset(release)?.name).toBe('update.json')
    expect(validateUpdate(release, manifest).notes).toBe('更新说明')
    for (const patch of [{ version: '1.2.4' }, { versionCode: 123 }, { size: -1 }, { sha256: 'bad' }, { fileName: '../evil.apk' }]) {
      expect(() => validateUpdate(release, { ...manifest, ...patch })).toThrow()
    }
    expect(() => validateUpdate({ ...release, assets: [] }, manifest)).toThrow()
    expect(() => validateUpdate({ ...release, assets: release.assets.map((a) => ({ ...a, size: 1 })) }, manifest)).toThrow()
    expect(() => validateUpdate({ ...release, assets: release.assets.map((a) => ({ ...a, browser_download_url: 'https://evil.test/app.apk' })) }, manifest)).toThrow()
    expect(manifestAsset({ ...release, assets: release.assets.map((a) => ({ ...a, state: 'new' })) })).toBeUndefined()
  })
})

describe('reminder policy', () => {
  it('uses local calendar days and suppresses repeated reminders only for that version', () => {
    const day = localDate(new Date(2026, 9, 4, 23, 59))
    expect(day).toBe('2026-10-04')
    const state = { promptedVersion: '1.2.3', promptedDate: day }
    expect(shouldPrompt({}, '1.2.3', day)).toBe(true)
    expect(shouldPrompt(state, '1.2.3', day)).toBe(false)
    expect(shouldPrompt(state, '1.2.3', '2026-10-05')).toBe(true)
    expect(shouldPrompt(state, '1.2.4', day)).toBe(true)
    expect(shouldPrompt({ skippedVersion: '1.2.3' }, '1.2.3', '2026-10-05')).toBe(false)
    expect(shouldPrompt({ skippedVersion: '1.2.3' }, '1.2.4', day)).toBe(true)
  })
})
