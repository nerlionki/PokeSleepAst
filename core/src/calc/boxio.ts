import type { BoxPokemon } from '../types'
import { INGREDIENTS, NATURES, POKEDEX, SUBSKILLS, pokeById } from './data'
import { foldText } from './text'
import { normalizeOcrMissing } from './ocrCompletion'
import { parseIqdoohEntry } from './iqdoohBox'

export type BoxSource = 'native' | 'sdrice' | 'rae' | 'iqdooh' | 'mixed'

const NATURE_EN: Record<string, string> = {
  lonely: '怕寂寞', adamant: '固执', naughty: '顽皮', brave: '勇敢',
  bold: '大胆', impish: '淘气', lax: '乐天', relaxed: '悠闲',
  modest: '内敛', mild: '慢吞吞', rash: '马虎', quiet: '冷静',
  calm: '温和', gentle: '温顺', careful: '慎重', sassy: '自大',
  timid: '胆小', hasty: '急躁', jolly: '爽朗', naive: '天真',
  bashful: '害羞', hardy: '勤奋', docile: '坦率', quirky: '浮躁', serious: '认真',
}

const NATURE_ID: Record<number, string> = {
  1: '怕寂寞', 2: '固执', 3: '顽皮', 4: '勇敢', 5: '大胆', 6: '淘气', 7: '乐天', 8: '悠闲',
  9: '内敛', 10: '慢吞吞', 11: '马虎', 12: '冷静', 13: '温和', 14: '温顺', 15: '慎重', 16: '自大',
  17: '胆小', 18: '急躁', 19: '爽朗', 20: '天真', 21: '害羞', 22: '勤奋', 23: '坦率', 24: '浮躁', 25: '认真',
}

const SUB_ALIAS: Record<string, string> = {
  hs: 'helpS', helpingspeeds: 'helpS', helpingspeed_s: 'helpS', 帮忙速度s: 'helpS', 帮忙s: 'helpS',
  hm: 'helpM', helpingspeedm: 'helpM', helpingspeed_m: 'helpM', 帮忙速度m: 'helpM', 帮忙m: 'helpM',
  fs: 'ingS', ingredientfinders: 'ingS', ingredientfinder_s: 'ingS', 食材概率提升s: 'ingS', 食材s: 'ingS',
  fm: 'ingM', ingredientfinderm: 'ingM', ingredientfinder_m: 'ingM', 食材概率提升m: 'ingM', 食材m: 'ingM',
  ss: 'skillS', skilltriggers: 'skillS', skilltrigger_s: 'skillS', 技能概率提升s: 'skillS', 技能s: 'skillS',
  sm: 'skillM', skilltriggerm: 'skillM', skilltrigger_m: 'skillM', 技能概率提升m: 'skillM', 技能m: 'skillM',
  cs: 'invS', inventoryups: 'invS', inventoryup_s: 'invS', 持有上限提升s: 'invS',
  cm: 'invM', inventoryupm: 'invM', inventoryup_m: 'invM', 持有上限提升m: 'invM',
  cl: 'invL', inventoryupl: 'invL', inventoryup_l: 'invL', 持有上限提升l: 'invL',
  sls: 'skillLevelS', skilllevelups: 'skillLevelS', skilllevelup_s: 'skillLevelS', 技能等级提升s: 'skillLevelS',
  slm: 'skillLevelM', skilllevelupm: 'skillLevelM', skilllevelup_m: 'skillLevelM', 技能等级提升m: 'skillLevelM',
  hg1: 'helpingBonus', hg2: 'helpingBonus', hg3: 'helpingBonus', hg4: 'helpingBonus', hg5: 'helpingBonus',
  helpingbonus: 'helpingBonus', 帮手奖励: 'helpingBonus', 帮手: 'helpingBonus',
  berrys: 'berryS', bfs: 'berryS', berryfindings: 'berryS', berryfinding_s: 'berryS', 树果数量s: 'berryS',
  energyrecover: 'energyRecover', energyrecoverybonus: 'energyRecover', erb: 'energyRecover', 活力回复奖励: 'energyRecover',
  sleepexp: 'sleepExp', sleepexpbonus: 'sleepExp', seb: 'sleepExp', 睡眠exp奖励: 'sleepExp',
  researchexp: 'researchExp', researchexpbonus: 'researchExp', reb: 'researchExp', 研究exp奖励: 'researchExp',
  shardbonus: 'shardBonus', dreamshardbonus: 'shardBonus', dsb: 'shardBonus', 梦之碎片奖励: 'shardBonus',
}

const ING_ALIAS: Record<string, number> = {
  largeleek: 1, 粗枝大葱: 1, tastymushroom: 2, 品鲜蘑菇: 2, fancyegg: 3, 特选蛋: 3,
  softeningpotato: 4, 窝心洋芋: 4, fancyapple: 5, 特选苹果: 5, fieryherb: 6, 火辣香草: 6,
  beansausage: 7, 豆制肉: 7, moomoamilk: 8, 哞哞鲜奶: 8,
  honey: 9, 甜甜蜜: 9, pureoil: 10, 纯粹油: 10, warmingginger: 11, 暖暖姜: 11,
  snoozytomato: 12, 好眠番茄: 12, soothingcacao: 13, 放松可可: 13, slowpoketail: 14, 美味尾巴: 14,
  greengrasssoybeans: 15, 萌绿大豆: 15, greengrasscorn: 16, 萌绿玉米: 16,
  refreshingcoffee: 17, 醒脑咖啡豆: 17, plumpumpkin: 18, 沉甸甸南瓜: 18, glossyavocado: 19, 嫩亮酪梨: 19,
}

const EN_NAME: Record<number, string> = {
  1: 'bulbasaur', 2: 'ivysaur', 3: 'venusaur', 4: 'charmander', 5: 'charmeleon', 6: 'charizard',
  7: 'squirtle', 8: 'wartortle', 9: 'blastoise', 10: 'caterpie', 11: 'metapod', 12: 'butterfree',
  19: 'rattata', 20: 'raticate', 23: 'ekans', 24: 'arbok', 25: 'pikachu', 26: 'raichu',
  27: 'sandshrew', 28: 'sandslash', 35: 'clefairy', 36: 'clefable', 37: 'vulpix', 38: 'ninetales',
  39: 'jigglypuff', 40: 'wigglytuff', 50: 'diglett', 51: 'dugtrio', 52: 'meowth', 53: 'persian',
  54: 'psyduck', 55: 'golduck', 56: 'mankey', 57: 'primeape', 58: 'growlithe', 59: 'arcanine',
  69: 'bellsprout', 70: 'weepinbell', 71: 'victreebel', 74: 'geodude', 75: 'graveler', 76: 'golem',
  79: 'slowpoke', 80: 'slowbro', 81: 'magnemite', 82: 'magneton', 83: 'farfetchd', 84: 'doduo', 85: 'dodrio',
  92: 'gastly', 93: 'haunter', 94: 'gengar', 95: 'onix', 104: 'cubone', 105: 'marowak',
  113: 'chansey', 115: 'kangaskhan', 122: 'mrmime', 127: 'pinsir', 132: 'ditto',
  133: 'eevee', 134: 'vaporeon', 135: 'jolteon', 136: 'flareon', 147: 'dratini', 148: 'dragonair', 149: 'dragonite',
  150: 'mewtwo', 151: 'mew', 152: 'chikorita', 153: 'bayleef', 154: 'meganium',
  155: 'cyndaquil', 156: 'quilava', 157: 'typhlosion', 158: 'totodile', 159: 'croconaw', 160: 'feraligatr',
  172: 'pichu', 173: 'cleffa', 174: 'igglybuff', 175: 'togepi', 176: 'togetic', 177: 'natu', 178: 'xatu',
  179: 'mareep', 180: 'flaaffy', 181: 'ampharos', 185: 'sudowoodo', 194: 'wooper', 195: 'quagsire',
  196: 'espeon', 197: 'umbreon', 198: 'murkrow', 199: 'slowking', 202: 'wobbuffet', 208: 'steelix',
  213: 'shuckle', 214: 'heracross', 215: 'sneasel', 225: 'delibird', 228: 'houndour', 229: 'houndoom',
  242: 'blissey', 243: 'raikou', 244: 'entei', 245: 'suicune', 246: 'larvitar', 247: 'pupitar', 248: 'tyranitar',
  252: 'treecko', 253: 'grovyle', 254: 'sceptile', 255: 'torchic', 256: 'combusken', 257: 'blaziken',
  258: 'mudkip', 259: 'marshtomp', 260: 'swampert', 280: 'ralts', 281: 'kirlia', 282: 'gardevoir',
  287: 'slakoth', 288: 'vigoroth', 289: 'slaking', 302: 'sableye', 303: 'mawile',
  304: 'aron', 305: 'lairon', 306: 'aggron', 311: 'plusle', 312: 'minun', 316: 'gulpin', 317: 'swalot',
  328: 'trapinch', 329: 'vibrava', 330: 'flygon', 333: 'swablu', 334: 'altaria',
  353: 'shuppet', 354: 'banette', 359: 'absol', 360: 'wynaut', 363: 'spheal', 364: 'sealeo', 365: 'walrein',
  371: 'bagon', 372: 'shelgon', 373: 'salamence', 380: 'latias', 381: 'latios',
  387: 'turtwig', 388: 'grotle', 389: 'torterra', 390: 'chimchar', 391: 'monferno', 392: 'infernape',
  393: 'piplup', 394: 'prinplup', 395: 'empoleon', 403: 'shinx', 404: 'luxio', 405: 'luxray',
  425: 'drifloon', 426: 'drifblim', 430: 'honchkrow', 438: 'bonsly', 439: 'mimejr', 440: 'happiny',
  442: 'spiritomb', 447: 'riolu', 448: 'lucario', 453: 'croagunk', 454: 'toxicroak',
  459: 'snover', 460: 'abomasnow', 461: 'weavile', 462: 'magnezone', 468: 'togekiss',
  470: 'leafeon', 471: 'glaceon', 475: 'gallade', 488: 'cresselia', 491: 'darkrai',
  517: 'munna', 518: 'musharna', 557: 'dwebble', 558: 'crustle', 627: 'rufflet', 628: 'braviary',
  696: 'tyrunt', 697: 'tyrantrum', 700: 'sylveon', 701: 'hawlucha', 702: 'dedenne',
  710: 'pumpkaboo', 711: 'gourgeist', 714: 'noibat', 715: 'noivern',
  736: 'grubbin', 737: 'charjabug', 738: 'vikavolt', 742: 'cutiefly', 743: 'ribombee',
  759: 'stufful', 760: 'bewear', 764: 'comfey', 777: 'togedemaru', 778: 'mimikyu', 780: 'drampa',
  845: 'cramorant', 848: 'toxel', 849: 'toxtricity', 906: 'sprigatito', 907: 'floragato', 908: 'meowscarada',
  909: 'fuecoco', 910: 'crocalor', 911: 'skeledirge', 912: 'quaxly', 913: 'quaxwell', 914: 'quaquaval',
  921: 'pawmi', 922: 'pawmo', 923: 'pawmot', 957: 'tinkatink', 958: 'tinkatuff', 959: 'tinkaton',
  974: 'cetoddle', 975: 'cetitan', 980: 'clodsire',
  7006: 'vulpixalola', 7007: 'ninetalesalola',
}

function keyOf(s: unknown): string {
  return foldText(String(s ?? ''))
}

function natureOf(raw: unknown): string {
  if (raw == null || raw === '') return '勤奋'
  if (typeof raw === 'number' && NATURE_ID[raw]) return NATURE_ID[raw]
  const k = keyOf(raw)
  if (NATURE_EN[k]) return NATURE_EN[k]
  const hit = NATURES.find((n) => keyOf(n.name) === k)
  if (hit) return hit.name
  if (k.includes('hup')) return '固执'
  if (k.includes('hdown')) return '大胆'
  return '勤奋'
}

function subOf(raw: unknown): string {
  if (raw == null || raw === '') return ''
  if (typeof raw === 'object') {
    const o = raw as Record<string, unknown>
    return subOf(o.id ?? o.name ?? o.subSkill ?? o.label)
  }
  const k = keyOf(raw)
  if (SUB_ALIAS[k]) return SUB_ALIAS[k]
  const byId = SUBSKILLS.find((s) => keyOf(s.id) === k || keyOf(s.name) === k)
  return byId?.id ?? ''
}

function subsOf(raw: unknown): string[] {
  if (!raw) return ['', '', '', '', '']
  if (Array.isArray(raw)) {
    const mapped = raw.map(subOf).filter(Boolean)
    return [mapped[0] ?? '', mapped[1] ?? '', mapped[2] ?? '', mapped[3] ?? '', mapped[4] ?? '']
  }
  if (typeof raw === 'object') {
    const o = raw as Record<string, unknown>
    const ordered = ['10', '25', '50', '75', '100', '0', '1', '2', '3', '4']
      .map((k) => o[k]).filter((v) => v != null)
    if (ordered.length) return subsOf(ordered)
    return subsOf(Object.values(o))
  }
  return subsOf(String(raw).split(/[|,，]/))
}

function pokeIdOf(raw: unknown): number {
  if (raw == null) return 0
  if (typeof raw === 'number' && pokeById(raw)) return raw
  const text = String(raw)
  const n = Number(text.replace(/^[^\d-]+/, ''))
  if (Number.isFinite(n) && pokeById(n)) return n
  const k = keyOf(text)
  const byName = POKEDEX.find((p) => keyOf(p.name) === k || keyOf(p.formKey) === k)
  if (byName) return byName.id
  const byEn = Object.entries(EN_NAME).find(([, en]) => en === k || k.includes(en) || en.includes(k))
  if (byEn && pokeById(Number(byEn[0]))) return Number(byEn[0])
  return 0
}

function ingIdOf(raw: unknown): number | null {
  if (raw == null) return null
  if (typeof raw === 'number') {
    if (INGREDIENTS.some((i) => i.id === raw)) return raw
    return raw
  }
  const k = keyOf(raw)
  if (ING_ALIAS[k]) return ING_ALIAS[k]
  const hit = INGREDIENTS.find((i) => keyOf(i.name) === k)
  return hit?.id ?? null
}

function slotsOf(pokeId: number, raw: unknown): [number, number, number] {
  const poke = pokeById(pokeId)
  const fallback: [number, number, number] = [0, 0, 0]
  if (!poke) return fallback
  if (typeof raw === 'string' && /^[ABC]{1,3}$/i.test(raw)) {
    return [0, 1, 2].map((i) => {
      const ch = raw[i]?.toUpperCase()
      return ch === 'B' ? 1 : ch === 'C' ? 2 : 0
    }) as [number, number, number]
  }
  const list = Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? Object.values(raw as object) : []
  const slots: [number, number, number] = [0, 0, 0]
  for (let i = 0; i < 3; i++) {
    const v = list[i]
    if (v == null) continue
    if (typeof v === 'number' && v >= 0 && v <= 2 && !poke.ingredients.some((ing) => ing.id === v)) {
      slots[i] = v
      continue
    }
    const id = ingIdOf(v)
    const idx = poke.ingredients.findIndex((ing) => ing.id === id)
    if (idx >= 0) slots[i] = idx
  }
  return slots
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : null
}

function extractList(raw: unknown): { list: unknown[], source: BoxSource } {
  if (Array.isArray(raw)) {
    if (raw.some(item => asRecord(item)?.dex != null)) return { list: raw, source: 'iqdooh' }
    if (raw.length && asRecord(raw[0])?.pokemonId != null) return { list: raw, source: 'sdrice' }
    if (raw.length && (asRecord(raw[0])?.pokemon != null || asRecord(raw[0])?.pokeId != null)) return { list: raw, source: 'rae' }
    return { list: raw, source: 'mixed' }
  }
  const o = asRecord(raw)
  if (!o) return { list: [], source: 'mixed' }
  if (o.version === 1 && Array.isArray(o.entries)) return { list: o.entries, source: 'iqdooh' }
  if (Array.isArray(o.pokemon) && o.schemaVersion) return { list: o.pokemon, source: 'native' }
  const rae = o.pokebox ?? o.PokeBox ?? o.pokeBox ?? asRecord(o.data)?.pokebox ?? o.pokemons
  if (Array.isArray(rae)) return { list: rae, source: 'rae' }
  if (Array.isArray(o.list) && o.list[0] && asRecord(o.list[0])?.pokemonId != null) return { list: o.list, source: 'sdrice' }
  if (Array.isArray(o.list)) return { list: o.list, source: 'mixed' }
  return { list: [], source: 'mixed' }
}

function nativeSlots(raw: unknown): BoxPokemon['ingredientSlots'] {
  if (!Array.isArray(raw)) return [0, 0, 0]
  const at = (index: number): number | null => {
    if (index >= raw.length) return 0
    if (raw[index] === null) return null
    const value = Number(raw[index])
    return Number.isInteger(value) && value >= 0 ? value : 0
  }
  return [at(0), at(1), at(2)]
}

function fromAny(item: unknown, source: BoxSource): BoxPokemon | null {
  const o = asRecord(item)
  if (!o) return null
  if (source === 'iqdooh') return parseIqdoohEntry(o)
  if (typeof o.pokeId === 'number' && o.uid) {
    return {
      uid: String(o.uid),
      pokeId: o.pokeId,
      level: Number(o.level) || 1,
      nature: natureOf(o.nature),
      subskills: Array.isArray(o.subskills) ? o.subskills.map(String) : ['', '', '', '', ''],
      ingredientSlots: nativeSlots(o.ingredientSlots),
      skillLevel: Number(o.skillLevel) || 1,
      name: String(o.name ?? o.note ?? ''),
      napping: Boolean(o.napping),
      ...(normalizeOcrMissing(o.ocrMissing).length ? { ocrMissing: normalizeOcrMissing(o.ocrMissing) } : {}),
      ...(o.shiny ? { shiny: true } : {}),
      tune: o.tune && typeof o.tune === 'object' ? o.tune as BoxPokemon['tune'] : undefined,
    }
  }
  const pokeId = pokeIdOf(o.pokemonId ?? o.pokemon ?? o.pokeId ?? o.pid ?? o.id)
  if (!pokeId) return null
  const uid = String(o.uid ?? o.uuid ?? o.dataId ?? `imp-${source}-${pokeId}-${o.level ?? 1}-${Math.random().toString(16).slice(2, 8)}`)
  return {
    uid,
    pokeId,
    level: Number(o.level ?? o.lv ?? 1) || 1,
    nature: natureOf(o.nature ?? o.character ?? o.natureId),
    subskills: subsOf(o.subskills ?? o.subSkill ?? o.subSkills ?? o.skill),
    ingredientSlots: slotsOf(pokeId, o.ingredientSlots ?? o.ingredients ?? o.useFoods ?? o.ingredient),
    skillLevel: Number(o.skillLevel ?? o.skilllevel ?? o.mainSkillLevel ?? 1) || 1,
    name: String(o.nickname ?? o.note ?? o.name ?? ''),
    napping: Boolean(o.napping),
  }
}

export function parseBoxImport(raw: unknown): { source: BoxSource, pokemon: BoxPokemon[], skipped: number } {
  const { list, source } = extractList(raw)
  const pokemon: BoxPokemon[] = []
  let skipped = 0
  for (const item of list) {
    const row = fromAny(item, source)
    if (row) pokemon.push(row)
    else skipped += 1
  }
  return { source, pokemon, skipped }
}

export function parseBoxText(text: string) {
  const trimmed = text.trim()
  if (!trimmed) return { source: 'mixed' as BoxSource, pokemon: [], skipped: 0 }
  return parseBoxImport(JSON.parse(trimmed))
}

export function exportNative(pokemon: BoxPokemon[]) {
  return { schemaVersion: 1 as const, pokemon }
}

export function exportSdrice(pokemon: BoxPokemon[]) {
  return pokemon.map((p) => ({
    dataId: p.uid,
    pokemonId: p.pokeId,
    isShiny: false,
    evotimes: 0,
    skilllevel: p.skillLevel,
    level: p.level,
    skill: p.subskills.filter(Boolean),
    character: p.nature,
    useFoods: p.ingredientSlots.map((slot) => slot ?? 0),
    nickname: p.name,
  }))
}
