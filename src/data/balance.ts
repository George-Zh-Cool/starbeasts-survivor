/**
 * 手感平衡旋钮（碰撞半径不在此改）。
 * Spawner / Player / EventDirector / Game 读取此处常量。
 */
import { enemyScale } from './enemies';
import { bossScale } from './bosses';

export { enemyScale, bossScale };

export const BALANCE = {
  /** 开局无敌 / 出生保护时长（秒） */
  spawnProtectSec: 4.2,
  /** 受伤后无敌帧 */
  invulnOnHit: 0.55,

  /** 刷怪基础间隔与衰减 */
  spawnIntervalBase: 1.35,
  spawnIntervalDecay: 0.009,
  spawnIntervalMin: 0.22,
  maxEnemiesBase: 22,
  maxEnemiesPerSec: 1.55,
  maxEnemiesCap: 200,
  maxEnemiesBossCap: 140,
  /** 额外连刷解锁时间 */
  burstAtSec: [55, 110] as const,
  eliteFirstSec: 36,
  eliteIntervalMin: 34,
  eliteIntervalRand: 14,

  /** 经验曲线：xpToNext = floor(base + (lv-1)*linear + lv^pow) */
  xpBase: 12,
  xpLinear: 7,
  xpPow: 1.42,

  /** 精英潮 */
  eliteTideDuration: 10,
  eliteTideRateMul: 3.2,
  eliteTideMaxBonus: 28,
  eliteTideInitialBurst: 7,
} as const;

export function xpToNextForLevel(level: number): number {
  return Math.floor(BALANCE.xpBase + (level - 1) * BALANCE.xpLinear + Math.pow(level, BALANCE.xpPow));
}

/** 调试叠加一行：当前难度倍率（按 B 切换） */
export function formatDifficultyDebug(timeSec: number, rateMul: number): string {
  const e = enemyScale(timeSec);
  const b = bossScale(timeSec);
  const t = Math.floor(timeSec);
  return `难度 ${t}s · 怪 HP×${e.hpMul.toFixed(2)} 速×${e.speedMul.toFixed(2)} 伤×${e.dmgMul.toFixed(2)} · Boss HP×${b.hpMul.toFixed(2)} 伤×${b.dmgMul.toFixed(2)} · 刷速×${rateMul.toFixed(2)}`;
}
