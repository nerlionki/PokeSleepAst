export function parseVersion(value: string): [number, number, number, number] {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:\.(0|[1-9]\d*))?$/.test(value)) {
    throw new Error('版本号必须为 MAJOR.MINOR.PATCH 或 MAJOR.MINOR.PATCH.HOTFIX')
  }
  const [major = 0, minor = 0, patch = 0, hotfix = 0] = value.split('.').map(Number)
  if (major > 2099 || minor > 999 || patch > 999 || hotfix > 99 || major + minor + patch + hotfix === 0) {
    throw new Error('版本范围：major 0..2099，minor/patch 0..999，不能为 0.0.0')
  }
  return [major, minor, patch, hotfix]
}

export function versionCode(value: string): number {
  if (value.split('.').length === 4) return buildVersionCode(value)
  const [major, minor, patch] = parseVersion(value)
  return major * 1_000_000 + minor * 1_000 + patch
}

/** Keep legacy three-part manifest codes readable; new packages reserve two digits for hotfixes. */
export function buildVersionCode(value: string): number {
  const [major, minor, patch, hotfix] = parseVersion(value)
  const code = (major * 1_000_000 + minor * 1_000 + patch) * 100 + hotfix
  if (code < 1 || code > 2_100_000_000) throw new Error('构建号超出 Android 支持范围')
  return code
}

export function compareVersions(a: string, b: string): number {
  const left = parseVersion(a), right = parseVersion(b)
  for (let i = 0; i < left.length; i++) {
    const difference = left[i]! - right[i]!
    if (difference) return difference
  }
  return 0
}

export function iosMarketingVersion(value: string): string {
  return parseVersion(value).slice(0, 3).join('.')
}

/** Accepted release naming, without allowing arbitrary suffixes or URL path components. */
export function versionFromTag(tag: string): string | null {
  const match = tag.match(/^v(\d+\.\d+\.\d+(?:\.\d+)?)$/)
    ?? tag.match(/^(\d+\.\d+\.\d+\.\d+)_hotfix$/)
  if (!match?.[1]) return null
  try { parseVersion(match[1]); return match[1] } catch { return null }
}
