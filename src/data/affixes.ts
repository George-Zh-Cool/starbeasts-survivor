/** 精英/高强度怪词缀（原创，中文） */

export type AffixId = 'swift' | 'hardened' | 'regen' | 'explosive' | 'split' | 'frost';

export interface AffixDef {
  id: AffixId;
  name: string;
  /** 头顶小标单字/短标 */
  tag: string;
  color: number;
  description: string;
  /** 移速倍率 */
  speedMul: number;
  /** 受伤倍率（<1 减伤） */
  damageTakenMul: number;
  /** 每秒回血占最大生命比例 */
  regenPerSec: number;
  /** 死亡爆炸：对玩家伤害与半径 */
  explodeDamage: number;
  explodeRadius: number;
  /** 死亡分裂小怪数量 */
  splitCount: number;
  /** 接触时给玩家施加减速秒数 / 移速系数 */
  frostDuration: number;
  frostFactor: number;
}

export const AFFIXES: Record<AffixId, AffixDef> = {
  swift: {
    id: 'swift',
    name: '迅疾',
    tag: '迅',
    color: 0xffe66d,
    description: '移速大幅提升',
    speedMul: 1.5,
    damageTakenMul: 1,
    regenPerSec: 0,
    explodeDamage: 0,
    explodeRadius: 0,
    splitCount: 0,
    frostDuration: 0,
    frostFactor: 1,
  },
  hardened: {
    id: 'hardened',
    name: '硬化',
    tag: '硬',
    color: 0xb8c0d0,
    description: '受到伤害大幅降低',
    speedMul: 0.92,
    damageTakenMul: 0.5,
    regenPerSec: 0,
    explodeDamage: 0,
    explodeRadius: 0,
    splitCount: 0,
    frostDuration: 0,
    frostFactor: 1,
  },
  regen: {
    id: 'regen',
    name: '再生',
    tag: '生',
    color: 0x80ed99,
    description: '持续回复生命',
    speedMul: 1,
    damageTakenMul: 1,
    regenPerSec: 0.045,
    explodeDamage: 0,
    explodeRadius: 0,
    splitCount: 0,
    frostDuration: 0,
    frostFactor: 1,
  },
  explosive: {
    id: 'explosive',
    name: '爆裂',
    tag: '爆',
    color: 0xff9f1c,
    description: '死亡时对附近玩家造成范围伤害',
    speedMul: 1,
    damageTakenMul: 1,
    regenPerSec: 0,
    explodeDamage: 22,
    explodeRadius: 3.2,
    splitCount: 0,
    frostDuration: 0,
    frostFactor: 1,
  },
  split: {
    id: 'split',
    name: '分裂',
    tag: '裂',
    color: 0xc77dff,
    description: '死亡时分裂出两只较弱小怪',
    speedMul: 1,
    damageTakenMul: 1.05,
    regenPerSec: 0,
    explodeDamage: 0,
    explodeRadius: 0,
    splitCount: 2,
    frostDuration: 0,
    frostFactor: 1,
  },
  frost: {
    id: 'frost',
    name: '冰霜',
    tag: '霜',
    color: 0x90e0ef,
    description: '接触使玩家短暂减速',
    speedMul: 0.95,
    damageTakenMul: 1,
    regenPerSec: 0,
    explodeDamage: 0,
    explodeRadius: 0,
    splitCount: 0,
    frostDuration: 1.6,
    frostFactor: 0.55,
  },
};

export const AFFIX_LIST: AffixDef[] = Object.values(AFFIXES);

export function pickRandomAffix(): AffixDef {
  return AFFIX_LIST[Math.floor(Math.random() * AFFIX_LIST.length)]!;
}

/** 精英必带；高强度普通怪有概率 */
export function rollAffixForSpawn(elite: boolean, kind: string, timeSec: number): AffixDef | null {
  if (elite) return pickRandomAffix();
  // 虚空甲虫：首 Boss 后再抬词缀压力
  if (kind === 'voidbeetle' && timeSec > 55 && Math.random() < 0.28) return pickRandomAffix();
  // 普通怪词缀：中后期才出现，避免前 60s 随机暴毙
  if (timeSec > 80 && Math.random() < 0.07) return pickRandomAffix();
  if (timeSec > 130 && Math.random() < 0.11) return pickRandomAffix();
  return null;
}
