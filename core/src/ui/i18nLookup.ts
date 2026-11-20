import { itemMessages } from './itemMessages'
import { encounterMessages } from './encounterMessages'
import { scorePlanMessages } from './scorePlanMessages'
import { recipeCoverageMessages } from './recipeCoverageMessages'
import { mealPlanMessages } from './mealPlanMessages'

const settingsSummary = '{island} · 营地 {bonus}% · {start}–{end} / {score}分';

const updatedLabels: Record<string, Record<string, string>> = {
  'zh-TW': { "全局食谱等级": "全域食譜等級", "单独设置食谱等级": "個別設定食譜等級", "未单独设置的食谱跟随全局食谱等级。": "未個別設定的食譜會套用全域食譜等級。", 全部料理: '全部料理', 露营券: '露營券', 跟随全局设置: '跟隨全域設定', "可以遇见全部类型的宝可梦": "可以遇見全部類型的寶可夢", 睡眠规划: '睡眠規劃', '没有匹配的活动。': '沒有匹配的活動。', [settingsSummary]: '{island} · 營地 {bonus}% · {start}–{end} / {score}分' },
  ja: { "全局食谱等级": "共通レシピレベル", "单独设置食谱等级": "レシピレベルを個別設定", "未单独设置的食谱跟随全局食谱等级。": "個別設定のないレシピには共通レベルが適用されます。", 全部料理: 'すべての料理', 露营券: 'グッドキャンプチケット', 跟随全局设置: '全体設定に従う', "可以遇见全部类型的宝可梦": "すべての睡眠タイプのポケモンに出会えます", 睡眠规划: '睡眠計画', '没有匹配的活动。': '該当するイベントはありません。', [settingsSummary]: '{island} · フィールドボーナス {bonus}% · {start}–{end} / {score}点' },
  en: { "全局食谱等级": "Default recipe level", "单独设置食谱等级": "Set individual recipe levels", "未单独设置的食谱跟随全局食谱等级。": "Recipes without an individual level use the default.", 全部料理: 'All dishes', 露营券: 'Good Camp Ticket', 跟随全局设置: 'Use global setting', "可以遇见全部类型的宝可梦": "Pokémon of all sleep types can appear", 睡眠规划: 'Sleep Planner', '没有匹配的活动。': 'No matching events.', [settingsSummary]: '{island} · Area bonus {bonus}% · {start}–{end} / {score} pts' },
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
    : updatedLabels[language]?.[lookup] ?? encounterMessages[language]?.[lookup] ?? itemMessages[language]?.[lookup] ?? scorePlanMessages[language]?.[lookup] ?? recipeCoverageMessages[language]?.[lookup] ?? mealPlanMessages[language]?.[lookup] ?? source;
  return fill(result, values);
}
