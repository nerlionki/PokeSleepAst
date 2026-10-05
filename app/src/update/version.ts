export function parseVersion(value: string): [number, number, number] {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value)) {
    throw new Error('版本号必须为 MAJOR.MINOR.PATCH')
  }
  const [major = 0, minor = 0, patch = 0] = value.split('.').map(Number)
  if (major > 2099 || minor > 999 || patch > 999 || major + minor + patch === 0) {
    throw new Error('版本范围：major 0..2099，minor/patch 0..999，不能为 0.0.0')
  }
  return [major, minor, patch]
}

export function versionCode(value: string): number {
  const [major, minor, patch] = parseVersion(value)
  return major * 1_000_000 + minor * 1_000 + patch
}
