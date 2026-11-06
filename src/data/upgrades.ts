import { getWeaponForm, type WeaponBranch, type WeaponTier } from './weapons';

export type UpgradeId =
  | 'damage'
  | 'firerate'
  | 'movespeed'
  | 'pierce'
  | 'maxhp'
  | 'lifesteal'
  | 'multishot'
  | 'pickup'
  // 词条
  | 'crit'
  | 'knockback'
  | 'cdr'
  | 'xpboost'
  | 'shield'
  | 'splash'
  | 'armor'
  | 'hunt'
  | 'nova'
  | 'reach'
  | 'mend'
  | 'edge'
  | 'guardstep'
  | 'barrage'
  // 进化（按角色在选池时动态注入）
  | 'evolve';

export type UpgradeKind = 'stat' | 'trait' | 'evolve';

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  description: string;
  rarity: 'common' | 'rare' | 'epic';
  kind: UpgradeKind;
  /** 升级卡底部协同提示（可选） */
  synergyHint?: string;
  /** 路线标签，出现在稀有度旁边 */
  tag?: string;
  /** 终阶进化卡指定甲 / 乙 */
  evolveBranch?: WeaponBranch;
  /** Apply stacked level (1-based after pick) — evolve handled externally */
  apply: (stats: MutableStats, level: number) => void;
}

export interface MutableStats {
  maxHp: number;
  hp: number;
  moveSpeed: number;
  damage: number;
  attackInterval: number;
  projectileSpeed: number;
  projectileCount: number;
  pierce: number;
  pickupRadius: number;
  lifeSteal: number;
  auraRadius: number;
  // 词条
  critChance: number;
  critMul: number;
  knockback: number;
  xpMul: number;
  shieldMax: number;
  shield: number;
  splashRadius: number;
  splashRatio: number;
  /** 受伤倍率，1 为原伤，越低越硬 */
  armor: number;
  /** 对精英和 Boss 的额外伤害 */
  bossDmg: number;
  /** 击杀爆开半径，0 为关闭 */
  killNova: number;
  killNovaRatio: number;
  /** 每秒回复 */
  regen: number;
  /** 弹道寿命加成（秒） */
  projLifeBonus: number;
}

export function createBaseTraitStats(): Pick<
  MutableStats,
  | 'critChance'
  | 'critMul'
  | 'knockback'
  | 'xpMul'
  | 'shieldMax'
  | 'shield'
  | 'splashRadius'
  | 'splashRatio'
  | 'armor'
  | 'bossDmg'
  | 'killNova'
  | 'killNovaRatio'
  | 'regen'
  | 'projLifeBonus'
> {
  return {
    critChance: 0,
    critMul: 1.75,
    knockback: 0,
    xpMul: 1,
    shieldMax: 0,
    shield: 0,
    splashRadius: 0,
    splashRatio: 0,
    armor: 1,
    bossDmg: 0,
    killNova: 0,
    killNovaRatio: 0,
    regen: 0,
    projLifeBonus: 0,
  };
}

export const UPGRADES: UpgradeDef[] = [
  {
    id: 'damage',
    name: '星核增幅',
    description: '攻击力 +18%',
    rarity: 'common',
    kind: 'stat',
    apply: (s) => {
      s.damage *= 1.18;
    },
  },
  {
    id: 'firerate',
    name: '迅击律动',
    description: '攻击间隔 -12%（射速提升）',
    rarity: 'common',
    kind: 'stat',
    synergyHint: '与「暴击晶核」协同：疾锋',
    apply: (s) => {
      s.attackInterval *= 0.88;
    },
  },
  {
    id: 'movespeed',
    name: '流光步',
    description: '移动速度 +12%',
    rarity: 'common',
    kind: 'stat',
    apply: (s) => {
      s.moveSpeed *= 1.12;
    },
  },
  {
    id: 'pierce',
    name: '弹射弹道',
    description: '投射物穿透 +1（环攻角色改为环半径 +0.4）',
    rarity: 'rare',
    kind: 'stat',
    synergyHint: '与「碎星溅射」协同：碎星裂变',
    apply: (s) => {
      s.pierce += 1;
      s.auraRadius += 0.4;
    },
  },
  {
    id: 'maxhp',
    name: '晶脉强化',
    description: '最大生命 +25，并立即回复等量生命',
    rarity: 'common',
    kind: 'stat',
    apply: (s) => {
      s.maxHp += 25;
      s.hp = Math.min(s.maxHp, s.hp + 25);
    },
  },
  {
    id: 'lifesteal',
    name: '噬星回响',
    description: '击杀吸血 +4% 最大生命（每次击杀）',
    rarity: 'rare',
    kind: 'stat',
    synergyHint: '与「星盾凝结」协同：晶甲回响',
    apply: (s) => {
      s.lifeSteal += 0.04;
    },
  },
  {
    id: 'multishot',
    name: '裂空连射',
    description: '同时发射数量 +1（环攻角色改为伤害 +15%）',
    rarity: 'epic',
    kind: 'stat',
    apply: (s) => {
      s.projectileCount += 1;
      s.damage *= 1.05;
    },
  },
  {
    id: 'pickup',
    name: '引力磁场',
    description: '经验拾取半径 +35%',
    rarity: 'common',
    kind: 'stat',
    apply: (s) => {
      s.pickupRadius *= 1.35;
    },
  },
  // —— 词条 ——
  {
    id: 'crit',
    name: '暴击晶核',
    description: '暴击率 +12%，暴击伤害 ×1.75 起',
    rarity: 'rare',
    kind: 'trait',
    synergyHint: '与「迅击律动」协同：疾锋（暴伤↑）',
    apply: (s) => {
      s.critChance = Math.min(0.65, s.critChance + 0.12);
    },
  },
  {
    id: 'knockback',
    name: '震波冲击',
    description: '攻击附带击退（对普通敌人有效）',
    rarity: 'rare',
    kind: 'trait',
    apply: (s) => {
      s.knockback += 2.2;
    },
  },
  {
    id: 'cdr',
    name: '冷却收缩',
    description: '攻击间隔再 -12%',
    rarity: 'rare',
    kind: 'trait',
    apply: (s) => {
      s.attackInterval *= 0.88;
    },
  },
  {
    id: 'xpboost',
    name: '星屑吸收',
    description: '获得经验 +15%',
    rarity: 'common',
    kind: 'trait',
    apply: (s) => {
      s.xpMul *= 1.15;
    },
  },
  {
    id: 'shield',
    name: '星盾凝结',
    description: '获得 25 点护盾（可叠加上限），受伤优先扣护盾',
    rarity: 'rare',
    kind: 'trait',
    synergyHint: '与「噬星回响」协同：晶甲回响（击杀掉盾）',
    apply: (s) => {
      s.shieldMax += 25;
      s.shield = Math.min(s.shieldMax, s.shield + 25);
    },
  },
  {
    id: 'splash',
    name: '碎星溅射',
    description: '命中产生溅射（与武器进化溅射叠加）',
    rarity: 'epic',
    kind: 'trait',
    synergyHint: '与「弹射弹道」协同：碎星裂变',
    apply: (s) => {
      s.splashRadius = Math.max(s.splashRadius, 1.4) + 0.6;
      s.splashRatio = Math.min(0.7, s.splashRatio + 0.25);
    },
  },
  {
    id: 'armor',
    name: '晶壳',
    description: '受到的伤害 -10%（最多减到约一半）',
    rarity: 'rare',
    kind: 'trait',
    tag: '生存',
    synergyHint: '与「星愈脉」协同：潮生甲',
    apply: (s) => {
      s.armor = Math.max(0.55, s.armor * 0.9);
    },
  },
  {
    id: 'hunt',
    name: '猎核',
    description: '对精英和 Boss 的伤害 +20%',
    rarity: 'rare',
    kind: 'trait',
    tag: '输出',
    synergyHint: '与「暴击晶核」协同：处刑印记',
    apply: (s) => {
      s.bossDmg = Math.min(1, s.bossDmg + 0.2);
    },
  },
  {
    id: 'nova',
    name: '余烬爆',
    description: '击杀时炸开一小圈，伤到旁边的敌人',
    rarity: 'epic',
    kind: 'trait',
    tag: '清场',
    synergyHint: '与「碎星溅射」协同：余烬连锁',
    apply: (s) => {
      if (s.killNova <= 0) {
        s.killNova = 2.15;
        s.killNovaRatio = 0.42;
      } else {
        s.killNova = Math.min(3.4, s.killNova + 0.28);
        s.killNovaRatio = Math.min(0.62, s.killNovaRatio + 0.08);
      }
    },
  },
  {
    id: 'reach',
    name: '延程',
    description: '弹道更快、飞得更远（环攻改为环半径略增）',
    rarity: 'common',
    kind: 'stat',
    tag: '输出',
    apply: (s) => {
      s.projectileSpeed *= 1.12;
      s.projLifeBonus = Math.min(2, s.projLifeBonus + 0.4);
      s.auraRadius += 0.2;
    },
  },
  {
    id: 'mend',
    name: '星愈脉',
    description: '立即回复 10 点生命，之后每秒缓慢再生',
    rarity: 'rare',
    kind: 'trait',
    tag: '生存',
    synergyHint: '与「晶壳」协同：潮生甲',
    apply: (s) => {
      s.hp = Math.min(s.maxHp, s.hp + 10);
      s.regen = Math.min(3, s.regen + 0.55);
    },
  },
  {
    id: 'edge',
    name: '锋芒',
    description: '攻击 +10%，暴击率 +4%',
    rarity: 'common',
    kind: 'stat',
    tag: '输出',
    apply: (s) => {
      s.damage *= 1.1;
      s.critChance = Math.min(0.72, s.critChance + 0.04);
    },
  },
  {
    id: 'guardstep',
    name: '守势步',
    description: '移速 +6%，受到的伤害再 -6%',
    rarity: 'rare',
    kind: 'stat',
    tag: '生存',
    apply: (s) => {
      s.moveSpeed *= 1.06;
      s.armor = Math.max(0.55, s.armor * 0.94);
    },
  },
  {
    id: 'barrage',
    name: '暴风核心',
    description: '发射数 +1，攻击间隔 -6%，伤害 +6%（环攻半径也略增）',
    rarity: 'epic',
    kind: 'stat',
    tag: '输出',
    apply: (s) => {
      s.projectileCount += 1;
      s.attackInterval *= 0.94;
      s.damage *= 1.06;
      s.auraRadius += 0.12;
    },
  },
];

/** 协同定义：拥有全部 required 时生效 */
export interface SynergyDef {
  id: string;
  name: string;
  required: UpgradeId[];
  description: string;
  applyOnce: (stats: MutableStats) => void;
}

export const SYNERGIES: SynergyDef[] = [
  {
    id: 'swift_edge',
    name: '疾锋',
    required: ['crit', 'firerate'],
    description: '暴击伤害 +0.35，攻击间隔再 -8%',
    applyOnce: (s) => {
      s.critMul += 0.35;
      s.attackInterval *= 0.92;
    },
  },
  {
    id: 'star_fission',
    name: '碎星裂变',
    required: ['splash', 'pierce'],
    description: '溅射半径 +30%，穿透 +1',
    applyOnce: (s) => {
      s.splashRadius *= 1.3;
      s.pierce += 1;
      s.auraRadius += 0.25;
    },
  },
  {
    id: 'crystal_echo',
    name: '晶甲回响',
    required: ['shield', 'lifesteal'],
    description: '击杀回复 8 点护盾；吸血 +2%',
    applyOnce: (s) => {
      s.lifeSteal += 0.02;
    },
  },
  {
    id: 'execution',
    name: '处刑印记',
    required: ['crit', 'hunt'],
    description: '对精英和 Boss 再 +16% 伤害，暴击伤害 +0.2',
    applyOnce: (s) => {
      s.bossDmg = Math.min(1.3, s.bossDmg + 0.16);
      s.critMul += 0.2;
    },
  },
  {
    id: 'tide_armor',
    name: '潮生甲',
    required: ['armor', 'mend'],
    description: '再减伤 6%，再生加快',
    applyOnce: (s) => {
      s.armor = Math.max(0.55, s.armor * 0.94);
      s.regen = Math.min(3.6, s.regen + 0.6);
    },
  },
  {
    id: 'ember_chain',
    name: '余烬连锁',
    required: ['nova', 'splash'],
    description: '击杀爆炸更大，溅射更疼',
    applyOnce: (s) => {
      s.killNova = Math.min(4.2, Math.max(2.2, s.killNova) * 1.25);
      s.splashRatio = Math.min(0.8, s.splashRatio + 0.08);
    },
  },
];

export function buildEvolveUpgrade(
  characterId: string,
  currentTier: WeaponTier,
  branch: WeaponBranch = 'a',
): UpgradeDef | null {
  if (currentTier >= 2) return null;
  const next = (currentTier + 1) as WeaponTier;
  const form = getWeaponForm(characterId, next, next === 2 ? branch : 'a');
  const branchLabel = next < 2 ? '一阶' : branch === 'b' ? '终阶 · 乙' : '终阶 · 甲';
  return {
    id: 'evolve',
    name: `武器进化 · ${form.name}`,
    description: form.description,
    rarity: 'epic',
    kind: 'evolve',
    tag: '进化',
    evolveBranch: next === 2 ? branch : 'a',
    synergyHint: `${branchLabel}。14 级前不选，会自动走上甲路线。`,
    apply: () => {
      /* handled by Game / Player.evolveWeapon */
    },
  };
}

export interface UpgradePickContext {
  characterId: string;
  weaponTier: WeaponTier;
  owned: Set<UpgradeId>;
  activatedSynergies: Set<string>;
}

export function pickRandomUpgrades(count: number, ctx?: UpgradePickContext): UpgradeDef[] {
  const owned = ctx?.owned ?? new Set<UpgradeId>();
  const pool: UpgradeDef[] = UPGRADES.filter((u) => {
    // 词条可重复叠层的允许再抽；进化单独处理
    if (u.id === 'evolve') return false;
    return true;
  });

  // 加权：未拥有的词条略提高权重
  const weighted: UpgradeDef[] = [];
  for (const u of pool) {
    let w = u.rarity === 'epic' ? 2 : u.rarity === 'rare' ? 3 : 5;
    // 生存向略加权，降低前期输出膨胀
    if (u.id === 'maxhp' || u.id === 'movespeed' || u.id === 'shield' || u.id === 'pickup' || u.id === 'mend' || u.id === 'armor') w += 2;
    if (u.id === 'damage' || u.id === 'firerate' || u.id === 'barrage') w = Math.max(2, w - 1);
    if (u.kind === 'trait' && !owned.has(u.id)) w += 2;
    if ((u.id === 'hunt' || u.id === 'nova' || u.id === 'edge') && !owned.has(u.id)) w += 1;
    // 已有一半协同时提高另一半出现率
    for (const syn of SYNERGIES) {
      if (ctx?.activatedSynergies.has(syn.id)) continue;
      const has = syn.required.filter((id) => owned.has(id) || id === u.id);
      if (syn.required.includes(u.id) && has.length === syn.required.length - 1) {
        w += 4;
      }
    }
    for (let i = 0; i < w; i++) weighted.push(u);
  }

  const keyOf = (u: UpgradeDef) => (u.id === 'evolve' ? `evolve:${u.evolveBranch ?? 'a'}` : u.id);
  const result: UpgradeDef[] = [];
  const used = new Set<string>();
  const tier = ctx?.weaponTier ?? 0;

  if (ctx && tier < 2) {
    const evolveA = buildEvolveUpgrade(ctx.characterId, tier, 'a');
    const evolveB = tier === 1 ? buildEvolveUpgrade(ctx.characterId, tier, 'b') : null;
    const roll = Math.random();
    if (tier === 1 && evolveA && evolveB && roll < 0.24) {
      result.push(evolveA, evolveB);
    } else if (evolveA && roll < (tier === 1 ? 0.7 : 0.4)) {
      result.push(tier === 1 && evolveB && Math.random() < 0.5 ? evolveB : evolveA);
    }
    for (const card of result) used.add(keyOf(card));
  }

  const shuffled = [...weighted].sort(() => Math.random() - 0.5);
  for (const u of shuffled) {
    const key = keyOf(u);
    if (used.has(key)) continue;
    used.add(key);
    result.push(u);
    if (result.length >= count) break;
  }

  if (result.length < count && ctx && tier < 2) {
    for (const branch of ['a', 'b'] as const) {
      if (tier === 0 && branch === 'b') continue;
      const card = buildEvolveUpgrade(ctx.characterId, tier, branch);
      if (!card || used.has(keyOf(card))) continue;
      result.push(card);
      if (result.length >= count) break;
    }
  }

  return result.slice(0, count);
}

/** 检查并应用新解锁的协同，返回本次新激活的协同 */
export function applyNewSynergies(
  owned: Set<UpgradeId>,
  already: Set<string>,
  stats: MutableStats,
): SynergyDef[] {
  const newly: SynergyDef[] = [];
  for (const syn of SYNERGIES) {
    if (already.has(syn.id)) continue;
    if (syn.required.every((id) => owned.has(id))) {
      syn.applyOnce(stats);
      already.add(syn.id);
      newly.push(syn);
    }
  }
  return newly;
}
