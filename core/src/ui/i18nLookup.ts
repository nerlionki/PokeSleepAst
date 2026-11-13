import { itemMessages } from './itemMessages'
import { encounterMessages } from './encounterMessages'

const updatedLabels: Record<string, Record<string, string>> = {
  'zh-TW': { "可以遇见全部类型的宝可梦": "可以遇見全部類型的寶可夢", 睡眠规划: '睡眠規劃', '没有匹配的活动。': '沒有匹配的活動。' },
  ja: { "可以遇见全部类型的宝可梦": "すべての睡眠タイプのポケモンに出会えます", 睡眠规划: '睡眠計画', '没有匹配的活动。': '該当するイベントはありません。' },
  en: { "可以遇见全部类型的宝可梦": "Pokémon of all sleep types can appear", 睡眠规划: 'Sleep Planner', '没有匹配的活动。': 'No matching events.' },
};

// Pure catalog lookup. The WeChat build loads this file from its own subpackage.
export type Catalog = {
  schemaVersion?: number;
  aliases?: Record<string, string>;
  locales?: Record<string, { messages?: Record<string, unknown> }>;
};

export function readCatalog(meta: unknown): Catalog | undefined {
  if (!meta || typeof meta !== 'object' || !('i18n' in meta)) return;
  const i18n = (meta as { i18n?: Catalog }).i18n;
  return i18n?.schemaVersion === 1 ? i18n : undefined;
}

type Values = Readonly<Record<string, string | number>>;

export function hasInterfaceTranslations(
  data: Catalog | undefined,
  next: string
): boolean {
  if (next === 'zh-CN') return true;
  const label = data?.locales?.[next]?.messages?.['界面语言'];
  return typeof label === 'string' && !!label.trim();
}

const catalogKey = /^(?:活动标题|活动礼包)#/;

export function fill(result: string, values?: Values): string {
  return values
    ? result.replace(/\{(\w+)\}/g, (token, name: string) =>
        Object.hasOwn(values, name) ? String(values[name]) : token
      )
    : result;
}

export function translate(
  data: Catalog | undefined,
  language: string,
  key = '',
  values?: Values,
  scope?: string
): string {
  const aliases = data?.aliases;
  const alias =
    aliases && Object.hasOwn(aliases, key) ? aliases[key] : undefined;
  let source = typeof alias === 'string' ? alias : key;
  const messages =
    language !== 'zh-CN' ? data?.locales?.[language]?.messages : undefined;
  // A display string can alias back to 活动标题#… / 活动礼包#…. Follow that only when
  // the locale actually has a translation; otherwise the raw key would replace the text.
  if (catalogKey.test(source) && !catalogKey.test(key)) {
    const via = messages?.[source];
    return fill(typeof via === 'string' && via.trim() ? via : key, values);
  }
  const lookup = source.includes('\n')
    ? source.replace(/\s+/g, ' ').trim()
    : source;
  const scopedKey = scope ? lookup + '#' + scope : lookup;
  const entry =
    messages && Object.hasOwn(messages, scopedKey)
      ? messages[scopedKey]
      : messages && Object.hasOwn(messages, lookup)
        ? messages[lookup]
        : undefined;
  const result = typeof entry === 'string' && entry.trim()
    ? entry
    : updatedLabels[language]?.[lookup] ?? encounterMessages[language]?.[lookup] ?? itemMessages[language]?.[lookup] ?? source;
  return fill(result, values);
}
