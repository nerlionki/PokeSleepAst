import { INGREDIENT_CATALOG } from './ingredientCatalog';
import { RECIPE_CATALOG } from './recipeCatalog';
import extracted0 from '../data/compatibility-maps.resource';
import { cloneData } from './dataClone';
import { BERRIES, berryByName } from './data';

import { localImage } from '#platform/images';
const raeImage_config_extracted0 = extracted0.modules.raeImage;

export function berryImageUrl(name: string): string {
  const berry = berryByName(name);
  const index = berry ? BERRIES.indexOf(berry) : -1;
  return index >= 0 ? localImage(`berry/${index + 1}.webp`) : '';
}

export function ingredientImageUrl(
  id: number,
  name?: string,
  imageFile?: string
): string {
  const catalog = name
    ? INGREDIENT_CATALOG.find(row => row.name === name)
    : undefined;
  let resolved = id > 0 ? id : 0;
  if (!resolved && catalog?.imageId && catalog.imageId > 0)
    resolved = catalog.imageId;
  if (resolved > 0)
    return (
      localImage(`ingredient/${resolved}.webp`) ||
      localImage('ingredient/0.webp')
    );
  const declared = imageFile ?? catalog?.imageFile;
  return (
    localImage(declared ?? 'ingredient/0.webp') ||
    localImage('ingredient/0.webp')
  );
}

/** RAE 副技能图编号，见 https://pks.raenonx.cc/zh/stats/subskill */
const SUBSKILL_IMAGE: Record<string, number> = cloneData(
  raeImage_config_extracted0.SUBSKILL_IMAGE
) as unknown as Record<string, number>;

export function subskillImageUrl(id: string): string {
  const image = SUBSKILL_IMAGE[id];
  return image ? localImage(`subSkill/${image}.webp`) : '';
}

/** RAE 主技能图编号，见 https://pks.raenonx.cc/zh/mainskill/info */
export function mainSkillImageUrl(id: number): string {
  return id > 0 ? localImage(`mainSkill/${id}.webp`) : '';
}

/** 南瓜精 / 南瓜怪人的体型档，对应 RAE 文件名 710-A2。 */
const POKEMON_FILE: Record<number, string> = cloneData(
  raeImage_config_extracted0.POKEMON_FILE
) as unknown as Record<number, string>;

export function pokemonFile(id: number): string {
  return POKEMON_FILE[id] ?? String(id);
}

export function pokemonIconUrl(id: number): string {
  return localImage(`pokemon/icons/${pokemonFile(id)}.webp`);
}

/** 异色图标，没有异色的宝可梦会是空字符串。 */
export function pokemonShinyIconUrl(id: number): string {
  return localImage(`pokemon/icons/shiny/${pokemonFile(id)}.webp`);
}

export function hasShiny(id: number): boolean {
  return Boolean(pokemonShinyIconUrl(id));
}

export function pokemonPortraitUrl(id: number): string {
  return localImage(`pokemon/portrait/${pokemonFile(id)}.webp`);
}

/** 异色全身图，没有异色的宝可梦会是空字符串。 */
export function pokemonShinyPortraitUrl(id: number): string {
  return localImage(`pokemon/portrait/shiny/${pokemonFile(id)}.webp`);
}

/** 旧资料没有食谱 id 时，仍用名称对照。新资料以食谱 id 为准。 */
const MEAL_ID: Record<string, number> = cloneData(
  raeImage_config_extracted0.MEAL_ID
) as unknown as Record<string, number>;

export function mealId(name: string): number | undefined {
  const row = RECIPE_CATALOG.find(item => item.name === name);
  if (row?.id && row.id > 0) return row.id;
  return MEAL_ID[name];
}

/** 食谱图片按编号映射为 meal/{id}.webp。完整目录用食谱 id，未公布数值的公告食谱用 imageId。 */
export function mealImageUrl(name: string, id?: number): string {
  const resolved = id && id > 0 ? id : mealId(name);
  if (resolved) return localImage(`meal/${resolved}.webp`);
  const declared = RECIPE_CATALOG.find(item => item.name === name)?.imageFile;
  return declared ? localImage(declared) : '';
}
