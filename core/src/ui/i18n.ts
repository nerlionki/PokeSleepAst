import { readonly, shallowRef } from 'vue';
import { activeSnapshot } from '../resources/runtime';
import { loadJson, saveJson } from '../storage';
import { gameLabel } from './gameLabels';

export const languages = [
  { id: 'zh-CN', label: '简体中文' },
  { id: 'zh-TW', label: '繁體中文' },
  { id: 'ja', label: '日本語' },
  { id: 'en', label: 'English' }
] as const;
export type Language = (typeof languages)[number]['id'];

const storageKey = 'language';
const selected = shallowRef<Language>('zh-CN');
export const language = readonly(selected);
let hydration: Promise<void> | undefined;
let saving = Promise.resolve();

export function hydrateLanguage() {
  return (hydration ??= loadJson<unknown>(storageKey, 'zh-CN')
    .then(saved => {
      if (languages.some(option => option.id === saved))
        selected.value = saved as Language;
    })
    .catch(() => {}));
}

export async function setLanguage(next: Language) {
  selected.value = next;
  const write = saving.then(() => saveJson(storageKey, next));
  saving = write.catch(() => {});
  return write;
}

type Values = Readonly<Record<string, string | number>>;

function catalog() {
  const meta = activeSnapshot()?.data['meta.json'] as
    | {
        i18n?: {
          schemaVersion?: number;
          aliases?: Record<string, string>;
          locales?: Record<string, { messages?: Record<string, unknown> }>;
        };
      }
    | undefined;
  return meta?.i18n?.schemaVersion === 1 ? meta.i18n : undefined;
}

export function hasInterfaceTranslations(next: Language): boolean {
  if (next === 'zh-CN') return true;
  const label = catalog()?.locales?.[next]?.messages?.['界面语言'];
  return typeof label === 'string' && !!label.trim();
}

const catalogKey = /^(?:活动标题|活动礼包)#/;

function fill(result: string, values?: Values): string {
  return values
    ? result.replace(/\{(\w+)\}/g, (token, name: string) =>
        Object.hasOwn(values, name) ? String(values[name]) : token
      )
    : result;
}

function translate(key: string, values?: Values, scope?: string): string {
  const data = catalog();
  const aliases = data?.aliases;
  const alias =
    aliases && Object.hasOwn(aliases, key) ? aliases[key] : undefined;
  let source = typeof alias === 'string' ? alias : key;
  const messages =
    selected.value !== 'zh-CN'
      ? data?.locales?.[selected.value]?.messages
      : undefined;
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
  const result = typeof entry === 'string' && entry.trim() ? entry : source;
  return fill(result, values);
}

export function t(key = '', values?: Values): string {
  return translate(key, values);
}

export function gameText(name = ''): string {
  return t(gameLabel(name));
}

/** A custom nickname stays as entered. A blank or species name is translated. */
export function individualName(
  label: string | undefined,
  species: string | undefined
): string {
  const custom = label?.trim();
  if (custom && custom !== species) return custom;
  return gameText(custom || species || '');
}

/** Default team names such as 队伍 1 follow the interface language. */
export function teamName(name: string): string {
  const indexed = /^队伍 (\d+)$/.exec(name);
  if (indexed) return t('队伍 {n}', { n: indexed[1] });
  return t(name);
}

/** Sleep length from a minute count, for example 8h 30m. */
export function formatSleepLength(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours <= 0) return t('{minutes}分钟', { minutes: rest });
  if (!rest) return t('{arg1}小时', { arg1: hours });
  return t('{hours}小时{minutes}分钟', { hours, minutes: rest });
}

export function catalogText(
  kind: '活动标题' | '活动礼包',
  id: string | undefined,
  name: string
): string {
  const key = kind + '#' + id;
  const localized = id ? t(key) : key;
  return localized === key ? gameText(name) : localized;
}

export function sleepStyleText(style: {
  styleName: string;
  pokeId: number;
  stars: number;
}): string {
  return translate(
    gameLabel(style.styleName),
    undefined,
    `${style.pokeId}-${style.stars}`
  );
}
