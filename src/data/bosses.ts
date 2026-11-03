export type BossPattern = 'charge' | 'ring' | 'summon';

export type BossShape = 'horn' | 'core';

export interface BossDef {
  id: string;
  name: string;
  color: number;
  accent: number;
  radius: number;
  baseHp: number;
  baseSpeed: number;
  contactDamage: number;
  xp: number;
  shape: BossShape;
  patterns: BossPattern[];
}

/** 裂空巨角 — 冲撞型 Boss（可风筝） */
export const BOSS_HORN: BossDef = {
  id: 'rift_horn',
  name: '裂空巨角',
  color: 0xff4d6d,
  accent: 0xffd166,
  radius: 1.85,
  baseHp: 1100,
  baseSpeed: 2.35,
  contactDamage: 18,
  xp: 80,
  shape: 'horn',
  patterns: ['charge', 'summon'],
};

/** 星环邪核 — 环形弹幕 + 召唤 */
export const BOSS_CORE: BossDef = {
  id: 'star_core',
  name: '星环邪核',
  color: 0x7b2cbf,
  accent: 0x4cc9f0,
  radius: 1.7,
  baseHp: 1050,
  baseSpeed: 2.0,
  contactDamage: 16,
  xp: 90,
  shape: 'core',
  patterns: ['ring', 'summon'],
};

export const BOSS_ROSTER: BossDef[] = [BOSS_HORN, BOSS_CORE];

/** Boss 随时间缩放：首只可打可风筝，后期加压 */
export function bossScale(timeSec: number): { hpMul: number; dmgMul: number; speedMul: number } {
  const t = Math.max(0, timeSec);
  return {
    hpMul: 1 + Math.floor(t / 60) * 0.28 + t * 0.006,
    dmgMul: 1 + Math.floor(t / 60) * 0.12 + Math.max(0, t - 120) * 0.002,
    speedMul: 1 + Math.min(0.32, t * 0.0018),
  };
}
