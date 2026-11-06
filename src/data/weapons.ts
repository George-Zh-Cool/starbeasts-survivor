/** 各角色武器进化形态（原创设定，无第三方 IP） */

export type WeaponTier = 0 | 1 | 2;
export type ShotStyle = 'flame' | 'shard' | 'thorn' | 'arc';

export interface WeaponForm {
  tier: WeaponTier;
  id: string;
  name: string;
  description: string;
  /** 投射物视觉缩放 */
  projScale: number;
  /** 覆盖投射物颜色；未设则用角色色 */
  projColor?: number;
  /** 溅射半径（火系爆裂） */
  splashRadius: number;
  /** 溅射伤害比例 */
  splashRatio: number;
  /** 连锁弹跳次数（火系连锁） */
  chainBounces: number;
  /** 水环层数 */
  auraRings: number;
  /** 潮汐脉冲：每隔该秒冲击一次 */
  pulseInterval: number;
  /** 脉冲击退力度 */
  pulseForce: number;
  /** 额外投射物数（风刃多重） */
  extraProjectiles: number;
  /** 额外穿透 */
  pierceBonus: number;
  /** 伤害倍率 */
  damageMul: number;
  /** 投射物寿命加成 */
  lifeBonus: number;
  /** 终阶分支。甲是原路线，乙是另一条打法。 */
  branch: 'a' | 'b';
  /** 环内敌人移速系数，1 表示不减速 */
  auraSlow: number;
  /** 命中减速秒数，0 表示不减速 */
  slowDuration: number;
  /** 减速后的移速系数 */
  slowFactor: number;
  /** 弹体像素。未设时按角色默认 */
  shot?: ShotStyle;
}

const BASIC: Omit<WeaponForm, 'tier' | 'id' | 'name' | 'description'> = {
  projScale: 1,
  splashRadius: 0,
  splashRatio: 0,
  chainBounces: 0,
  auraRings: 1,
  pulseInterval: 0,
  pulseForce: 0,
  extraProjectiles: 0,
  pierceBonus: 0,
  damageMul: 1,
  lifeBonus: 0,
  branch: 'a',
  auraSlow: 1,
  slowDuration: 0,
  slowFactor: 1,
};

/** 焰心狐：火弹 → 爆裂弹 → 连锁火球 */
export const FLAME_FORMS: WeaponForm[] = [
  {
    ...BASIC,
    tier: 0,
    id: 'flame_basic',
    name: '火核弹',
    description: '基础火系弹道',
    projScale: 1,
  },
  {
    ...BASIC,
    tier: 1,
    id: 'flame_burst',
    name: '爆裂弹',
    description: '命中溅射周围敌人，弹体更大更亮',
    projScale: 1.45,
    projColor: 0xff9f1c,
    splashRadius: 2.2,
    splashRatio: 0.45,
    damageMul: 1.15,
  },
  {
    ...BASIC,
    tier: 2,
    id: 'flame_chain',
    name: '连锁火球',
    description: '命中后弹跳至附近敌人，并保留溅射',
    projScale: 1.65,
    projColor: 0xffe66d,
    splashRadius: 1.6,
    splashRatio: 0.35,
    chainBounces: 3,
    damageMul: 1.25,
    lifeBonus: 0.6,
  },
];

/** 潮汐龟：水环 → 双环 → 潮汐脉冲 */
export const TIDE_FORMS: WeaponForm[] = [
  {
    ...BASIC,
    tier: 0,
    id: 'tide_basic',
    name: '水波环',
    description: '基础近身环攻',
    auraRings: 1,
  },
  {
    ...BASIC,
    tier: 1,
    id: 'tide_dual',
    name: '双潮环',
    description: '内外双环同时伤害，环半径略增',
    auraRings: 2,
    damageMul: 1.1,
  },
  {
    ...BASIC,
    tier: 2,
    id: 'tide_pulse',
    name: '潮汐脉冲',
    description: '双环基础上周期性脉冲冲击并击退',
    auraRings: 2,
    pulseInterval: 2.2,
    pulseForce: 4.5,
    damageMul: 1.2,
  },
];

/** 风刃隼：风刃 → 多重风刃 → 穿透风暴 */
export const WIND_FORMS: WeaponForm[] = [
  {
    ...BASIC,
    tier: 0,
    id: 'wind_basic',
    name: '风刃',
    description: '高速风刃弹道',
    projScale: 0.9,
  },
  {
    ...BASIC,
    tier: 1,
    id: 'wind_multi',
    name: '多重风刃',
    description: '额外扇形风刃，清场更快',
    projScale: 1.05,
    projColor: 0xc77dff,
    extraProjectiles: 2,
    damageMul: 1.05,
  },
  {
    ...BASIC,
    tier: 2,
    id: 'wind_storm',
    name: '穿透风暴',
    description: '强穿透 + 更大风刃，贯穿战场',
    projScale: 1.35,
    projColor: 0xe0aaff,
    extraProjectiles: 2,
    pierceBonus: 3,
    damageMul: 1.2,
    lifeBonus: 0.8,
  },
];

/** 终阶乙：和甲同一级，打法不同，只能选一条。 */
const FLAME_BRANCH_B: WeaponForm = {
  ...BASIC,
  tier: 2,
  branch: 'b',
  id: 'flame_core',
  name: '熔核爆弹',
  description: '不弹跳。弹体更大，命中炸开大范围高额溅射。',
  projScale: 1.95,
  projColor: 0xff5a1f,
  splashRadius: 3.5,
  splashRatio: 0.7,
  damageMul: 1.42,
};

const TIDE_BRANCH_B: WeaponForm = {
  ...BASIC,
  tier: 2,
  branch: 'b',
  id: 'tide_vortex',
  name: '漩涡囚笼',
  description: '三层潮环，圈内敌人大幅减速，适合贴身困住一群。',
  auraRings: 3,
  auraSlow: 0.58,
  damageMul: 1.22,
};

const WIND_BRANCH_B: WeaponForm = {
  ...BASIC,
  tier: 2,
  branch: 'b',
  id: 'wind_fan',
  name: '裂风回旋',
  description: '一次打出五道风刃，清群更快，穿透不如穿透风暴。',
  projScale: 1.12,
  projColor: 0xd0b3ff,
  extraProjectiles: 4,
  pierceBonus: 1,
  damageMul: 1.08,
};

/** 霜铃貂：霜铃刺 → 双铃霜刺 → 冻潮连珠 / 霜域爆铃 */
const FROST_FORMS: WeaponForm[] = [
  {
    ...BASIC,
    tier: 0,
    id: 'frost_basic',
    name: '霜铃刺',
    description: '命中短暂减速，方便拉开距离',
    projScale: 0.95,
    projColor: 0xb8f3ff,
    shot: 'thorn',
    slowDuration: 0.65,
    slowFactor: 0.62,
  },
  {
    ...BASIC,
    tier: 1,
    id: 'frost_twin',
    name: '双铃霜刺',
    description: '双发霜刺，减速更久',
    projScale: 1.05,
    projColor: 0xd7f7ff,
    shot: 'thorn',
    extraProjectiles: 1,
    damageMul: 1.08,
    slowDuration: 0.8,
    slowFactor: 0.55,
  },
  {
    ...BASIC,
    tier: 2,
    id: 'frost_chain',
    name: '冻潮连珠',
    description: '穿透并弹向旁边的敌人，一路留着减速',
    projScale: 1.15,
    projColor: 0xf2fcff,
    shot: 'thorn',
    pierceBonus: 2,
    chainBounces: 2,
    damageMul: 1.18,
    lifeBonus: 0.35,
    slowDuration: 0.9,
    slowFactor: 0.5,
  },
];

/** 雷脊蜥：脊电束 → 分叉电弧 → 雷脊连弧 / 爆核雷击 */
const STORM_FORMS: WeaponForm[] = [
  {
    ...BASIC,
    tier: 0,
    id: 'storm_basic',
    name: '脊电束',
    description: '短程电弧，命中后跳向近处另一只',
    projScale: 1.15,
    projColor: 0xfff3a0,
    shot: 'arc',
    chainBounces: 1,
    lifeBonus: -0.85,
    damageMul: 1.05,
  },
  {
    ...BASIC,
    tier: 1,
    id: 'storm_fork',
    name: '分叉电弧',
    description: '双发电弧，弹跳更多',
    projScale: 1.2,
    projColor: 0xffe56a,
    shot: 'arc',
    extraProjectiles: 1,
    chainBounces: 2,
    lifeBonus: -0.55,
    damageMul: 1.12,
  },
  {
    ...BASIC,
    tier: 2,
    id: 'storm_chain',
    name: '雷脊连弧',
    description: '电弧连跳整片，并多穿透一发',
    projScale: 1.28,
    projColor: 0xfff6c2,
    shot: 'arc',
    chainBounces: 4,
    pierceBonus: 1,
    lifeBonus: -0.15,
    damageMul: 1.22,
  },
];

const FROST_BRANCH_B: WeaponForm = {
  ...BASIC,
  tier: 2,
  branch: 'b',
  id: 'frost_burst',
  name: '霜域爆铃',
  description: '不穿透。命中炸开霜圈，圈里的敌人都被钉慢。',
  projScale: 1.55,
  projColor: 0xe8fbff,
  shot: 'thorn',
  splashRadius: 2.8,
  splashRatio: 0.55,
  damageMul: 1.3,
  slowDuration: 1.05,
  slowFactor: 0.46,
};

const STORM_BRANCH_B: WeaponForm = {
  ...BASIC,
  tier: 2,
  branch: 'b',
  id: 'storm_core',
  name: '爆核雷击',
  description: '不弹跳。短程电团命中后炸开，适合贴脸清一团。',
  projScale: 1.75,
  projColor: 0xffd23a,
  shot: 'arc',
  splashRadius: 3.15,
  splashRatio: 0.65,
  damageMul: 1.4,
  lifeBonus: -0.35,
};

const BY_CHAR: Record<string, WeaponForm[]> = {
  flamefox: FLAME_FORMS,
  tideturtle: TIDE_FORMS,
  windfalcon: WIND_FORMS,
  frostmarten: FROST_FORMS,
  stormlizard: STORM_FORMS,
};

const BRANCH_B: Record<string, WeaponForm> = {
  flamefox: FLAME_BRANCH_B,
  tideturtle: TIDE_BRANCH_B,
  windfalcon: WIND_BRANCH_B,
  frostmarten: FROST_BRANCH_B,
  stormlizard: STORM_BRANCH_B,
};

export type WeaponBranch = 'a' | 'b';

export function getWeaponForms(characterId: string): WeaponForm[] {
  return BY_CHAR[characterId] ?? FLAME_FORMS;
}

export function getWeaponForm(characterId: string, tier: WeaponTier, branch: WeaponBranch = 'a'): WeaponForm {
  if (tier >= 2 && branch === 'b') {
    const alt = BRANCH_B[characterId];
    if (alt) return alt;
  }
  const forms = getWeaponForms(characterId);
  return forms[Math.min(tier, forms.length - 1)]!;
}

export function describeWeaponPaths(characterId: string): { step: string; name: string; description: string }[] {
  const forms = getWeaponForms(characterId);
  const alt = getWeaponForm(characterId, 2, 'b');
  return [
    { step: '初阶', name: forms[0]!.name, description: forms[0]!.description },
    { step: '一阶', name: forms[1]!.name, description: forms[1]!.description },
    { step: '终阶 · 甲', name: forms[2]!.name, description: forms[2]!.description },
    { step: '终阶 · 乙', name: alt.name, description: alt.description },
  ];
}

/** 自动进化等级门槛：未选手动进化时，到达该等级自动升一阶 */
export const AUTO_EVOLVE_LEVEL: Record<1 | 2, number> = {
  1: 7,
  2: 14,
};
