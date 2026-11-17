import { activeSnapshot } from './runtime'

export function resourceGameLabel(name: string): string | undefined {
  const meta = activeSnapshot()?.data['meta.json'] as {
    i18n?: { aliases?: Record<string, unknown> }
  } | undefined
  const aliases = meta?.i18n?.aliases
  const alias = aliases && Object.hasOwn(aliases, name) ? aliases[name] : undefined
  if (typeof alias === 'string' && alias.trim() && !/^(?:活动标题|活动礼包)#/.test(alias)) {
    return alias
  }
}
