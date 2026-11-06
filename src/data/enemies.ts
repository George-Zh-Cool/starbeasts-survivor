export type EnemyKind = 'darkcrystal' | 'riftwolf' | 'voidbeetle' | 'embermoth' | 'rockcrab' | 'elite';

export interface EnemyDef {
  kind: EnemyKind;
  name: string;
  color: number;
  radius: number;
  baseHp: number;
  baseSpeed: number;
  contactDamage: number;
  xp: number;
  /** Relative spawn weight */
  weight: number;
  shape: 'crystal' | 'wolf' | 'beetle' | 'elite' | 'moth' | 'crab';
}

export const ENEMY_DEFS: Record<Exclude<EnemyKind, 'elite'>, EnemyDef> = {
  darkcrystal: {
    kind: 'darkcrystal',
    name: '暗晶兽',
    color: 0x5c4d7a,
    radius: 0.55,
    baseHp: 24,
    baseSpeed: 3.3,
    contactDamage: 7,
    xp: 1,
    weight: 58,
    shape: 'crystal',
  },
  riftwolf: {
    kind: 'riftwolf',
    name: '裂影狼',
    color: 0xb5179e,
    radius: 0.48,
    baseHp: 16,
    baseSpeed: 5.0,
    contactDamage: 5,
    xp: 1,
    weight: 28,
    shape: 'wolf',
  },
  voidbeetle: {
    kind: 'voidbeetle',
    name: '虚空甲虫',
    color: 0x1d3557,
    radius: 0.7,
    baseHp: 50,
    baseSpeed: 2.55,
    contactDamage: 11,
    xp: 2,
    weight: 14,
    shape: 'beetle',
  },
  embermoth: {
    kind: 'embermoth',
    name: '星萤蛾',
    color: 0xffc857,
    radius: 0.4,
    baseHp: 10,
    baseSpeed: 6.15,
    contactDamage: 4,
    xp: 1,
    weight: 0,
    shape: 'moth',
  },
  rockcrab: {
    kind: 'rockcrab',
    name: '岩壳蟹',
    color: 0xd4894a,
    radius: 0.78,
    baseHp: 78,
    baseSpeed: 2.05,
    contactDamage: 13,
    xp: 3,
    weight: 0,
    shape: 'crab',
  },
};

export const ELITE_DEF: EnemyDef = {
  kind: 'elite',
  name: '深渊督卫',
  color: 0xff006e,
  radius: 1.1,
  baseHp: 200,
  baseSpeed: 2.95,
  contactDamage: 16,
  xp: 12,
  weight: 0,
  shape: 'elite',
};

/**
 * 随时间缩放：前 60s 缓和教学，60–120 抬升，120+ 明显加压但不指数爆炸。
 * 碰撞半径不变。
 */
export function enemyScale(timeSec: number): { hpMul: number; speedMul: number; dmgMul: number } {
  const t = Math.max(0, timeSec);
  // 分段：前期衰减系数更小
  const early = Math.min(t, 60);
  const mid = Math.max(0, Math.min(t - 60, 60));
  const late = Math.max(0, t - 120);
  return {
    hpMul: 1 + early * 0.018 + mid * 0.026 + late * 0.032 + Math.floor(t / 45) * 0.18,
    speedMul: 1 + Math.min(0.55, early * 0.005 + mid * 0.0065 + late * 0.004),
    dmgMul: 1 + early * 0.006 + mid * 0.01 + late * 0.012 + Math.floor(t / 60) * 0.06,
  };
}
