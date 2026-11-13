import { load } from '#i18n-loader'

type Values = Readonly<Record<string, string | number>>
type Catalog = {
  schemaVersion?: number
  aliases?: Record<string, string>
  locales?: Record<string, { messages?: Record<string, unknown> }>
}

export type I18nPack = {
  gameLabel(name: string): string
  translate(catalog: Catalog | undefined, language: string, key: string, values?: Values, scope?: string): string
  hasInterfaceTranslations(catalog: Catalog | undefined, language: string): boolean
}

let pack: I18nPack | undefined
let loading: Promise<void> | undefined

/** Download the i18n subpackage once. Later calls share the same promise. */
export function loadI18nPack() {
  return (loading ??= load()
    .then(mod => { pack = mod })
    .catch(() => {}))
}

export function i18nPack() {
  return pack
}

void loadI18nPack()
