/** 大厅可选的起始武装。解锁后下一局能选；0 阶名字会叠在星兽自己的武器上。 */
import type { WeaponKind } from './characters';
import type { MutableStats } from './upgrades';
import type { WeaponForm } from './weapons';

export type StarterId = 'plain' | 'riftbow' | 'tidemallet';

export interface StarterWeapon {
  id: StarterId;
  name: string;
  blurb: string;
}

export const STARTERS: StarterWeapon[] = [
  {
    id: 'plain',
    name: '原装',
    blurb: '用这只星兽自己的初阶武器',
  },
  {
    id: 'riftbow',
    name: '裂星弩',
    blurb: '弹道穿透更快；环攻转得更快，伤害略低',
  },
  {
    id: 'tidemallet',
    name: '潮鸣锤',
    blurb: '开局更重更慢，击退更远',
  },
];

export function isStarterId(id: string): id is StarterId {
  return id === 'plain' || id === 'riftbow' || id === 'tidemallet';
}

export function getStarter(id: string): StarterWeapon {
  return STARTERS.find((s) => s.id === id) ?? STARTERS[0]!;
}

/** 只改开局数值。进化后的形态仍走星兽自己的甲 / 乙。 */
export function applyStarter(stats: MutableStats, kind: WeaponKind, id: string): void {
  if (id === 'riftbow') {
    if (kind === 'aura') {
      stats.damage *= 0.94;
      stats.attackInterval = Math.max(0.12, stats.attackInterval * 0.88);
    } else {
      stats.damage *= 0.9;
      stats.projectileSpeed *= 1.14;
    }
    return;
  }
  if (id === 'tidemallet') {
    stats.damage *= 1.16;
    stats.attackInterval = Math.max(0.12, stats.attackInterval * 1.14);
    stats.knockback += 2.6;
    if (kind === 'aura') stats.auraRadius += 0.45;
    else stats.projectileSpeed *= 0.78;
  }
}

/** 0 阶把起始武装的名字叠上去，并给裂星弩补一发穿透。 */
export function overlayTier0(form: WeaponForm, kind: WeaponKind, id: string): WeaponForm {
  if (form.tier > 0 || id === 'plain' || !id) return form;
  const starter = getStarter(id);
  if (id === 'riftbow') {
    const aura = kind === 'aura';
    return {
      ...form,
      name: `${starter.name}·${form.name}`,
      description: aura
        ? `起始武装：环转得更快。${form.description}`
        : `起始武装：弹更快，穿透 +1。${form.description}`,
      pierceBonus: form.pierceBonus + (aura ? 0 : 1),
      shot: form.shot ?? (aura ? undefined : 'shard'),
      projScale: Math.max(form.projScale, 1.05),
    };
  }
  if (id === 'tidemallet') {
    return {
      ...form,
      name: `${starter.name}·${form.name}`,
      description:
        kind === 'aura'
          ? `起始武装：环更大更沉。${form.description}`
          : `起始武装：弹更短更重。${form.description}`,
      lifeBonus: form.lifeBonus + (kind === 'aura' ? 0 : -0.5),
      projScale: form.projScale * 1.22,
    };
  }
  return form;
}
