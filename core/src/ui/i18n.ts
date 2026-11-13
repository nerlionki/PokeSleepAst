import { readonly, shallowRef } from 'vue';
import { activeSnapshot } from '../resources/runtime';
import { loadJson, saveJson } from '../storage';
import { gameLabel } from './gameLabels';
import {
  hasInterfaceTranslations as catalogHasInterfaceTranslations,
  readCatalog,
  translate as catalogTranslate
} from './i18nLookup';

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
  return readCatalog(activeSnapshot()?.data['meta.json']);
}

export function hasInterfaceTranslations(next: Language): boolean {
  return catalogHasInterfaceTranslations(catalog(), next);
}

function translate(key = '', values?: Values, scope?: string): string {
  return catalogTranslate(catalog(), selected.value, key, values, scope);
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
