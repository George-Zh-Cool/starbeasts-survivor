/** 各角色武器进化形态（原创设定，无第三方 IP） */

export type WeaponTier = 0 | 1 | 2;

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

const BY_CHAR: Record<string, WeaponForm[]> = {
  flamefox: FLAME_FORMS,
  tideturtle: TIDE_FORMS,
  windfalcon: WIND_FORMS,
};

export function getWeaponForms(characterId: string): WeaponForm[] {
  return BY_CHAR[characterId] ?? FLAME_FORMS;
}

export function getWeaponForm(characterId: string, tier: WeaponTier): WeaponForm {
  const forms = getWeaponForms(characterId);
  return forms[Math.min(tier, forms.length - 1)]!;
}

/** 自动进化等级门槛：未选手动进化时，到达该等级自动升一阶 */
export const AUTO_EVOLVE_LEVEL: Record<1 | 2, number> = {
  1: 7,
  2: 14,
};
