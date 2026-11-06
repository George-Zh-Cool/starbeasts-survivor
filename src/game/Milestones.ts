/** 本机里程碑。只看这台浏览器的纪录，达成后从下一局开始给一点点开局加成。 */
import type { MutableStats } from '../data/upgrades';
import { loadHighScores, loadLocalRuns } from './HighScores';

const LS_BOSSES = 'starbeasts_boss_kills';

export interface Milestone {
  id: string;
  name: string;
  detail: string;
  reward: string;
  unlocked: boolean;
  apply: (stats: MutableStats) => void;
}

function readBossKills(): number {
  try {
    const n = Number(localStorage.getItem(LS_BOSSES));
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

export function recordBossKill(): void {
  try {
    localStorage.setItem(LS_BOSSES, String(readBossKills() + 1));
  } catch {
    /* ignore */
  }
}

export function listMilestones(): Milestone[] {
  const highs = loadHighScores();
  const runs = loadLocalRuns();
  const bestLevel = runs.reduce((max, run) => Math.max(max, run.level), 0);
  const bosses = readBossKills();
  const defs: Omit<Milestone, 'unlocked'>[] = [
    {
      id: 'tide_1',
      name: '潮头印记',
      detail: '单局存活达到 1:00',
      reward: '开局生命 +10',
      apply: (s) => {
        s.maxHp += 10;
        s.hp += 10;
      },
    },
    {
      id: 'tide_3',
      name: '三潮徽章',
      detail: '单局存活达到 3:00',
      reward: '开局移速 +6%',
      apply: (s) => {
        s.moveSpeed *= 1.06;
      },
    },
    {
      id: 'tide_5',
      name: '长夜徽章',
      detail: '单局存活达到 5:00',
      reward: '开局生命 +12',
      apply: (s) => {
        s.maxHp += 12;
        s.hp += 12;
      },
    },
    {
      id: 'hunt_80',
      name: '初猎刻印',
      detail: '单局击杀达到 80',
      reward: '获得经验 +8%',
      apply: (s) => {
        s.xpMul *= 1.08;
      },
    },
    {
      id: 'hunt_250',
      name: '屠潮刻印',
      detail: '单局击杀达到 250',
      reward: '开局攻击 +8%',
      apply: (s) => {
        s.damage *= 1.08;
      },
    },
    {
      id: 'lv12',
      name: '星辉刻印',
      detail: '单局等级达到 12',
      reward: '开局护盾 12',
      apply: (s) => {
        s.shieldMax += 12;
        s.shield += 12;
      },
    },
    {
      id: 'boss_1',
      name: '裂角战利',
      detail: '累计击败 1 只 Boss',
      reward: '对精英和 Boss 伤害 +8%',
      apply: (s) => {
        s.bossDmg += 0.08;
      },
    },
    {
      id: 'boss_3',
      name: '连屠巨兽',
      detail: '累计击败 3 只 Boss',
      reward: '开局生命 +8，击杀吸血 +1%',
      apply: (s) => {
        s.maxHp += 8;
        s.hp += 8;
        s.lifeSteal += 0.01;
      },
    },
  ];
  const unlockedById: Record<string, boolean> = {
    tide_1: highs.bestTimeSec >= 60,
    tide_3: highs.bestTimeSec >= 180,
    tide_5: highs.bestTimeSec >= 300,
    hunt_80: highs.bestKills >= 80,
    hunt_250: highs.bestKills >= 250,
    lv12: bestLevel >= 12,
    boss_1: bosses >= 1,
    boss_3: bosses >= 3,
  };
  return defs.map((def) => ({ ...def, unlocked: !!unlockedById[def.id] }));
}

export function milestoneIds(): Set<string> {
  return new Set(listMilestones().filter((m) => m.unlocked).map((m) => m.id));
}

export function newlyUnlockedMilestones(before: Set<string>): Milestone[] {
  return listMilestones().filter((m) => m.unlocked && !before.has(m.id));
}

/** 把已经点亮的里程碑加到这局开局属性上。返回实际生效的条目。 */
export function applyMilestoneBonuses(stats: MutableStats): Milestone[] {
  const unlocked = listMilestones().filter((m) => m.unlocked);
  for (const m of unlocked) m.apply(stats);
  stats.hp = Math.min(stats.maxHp, Math.max(stats.hp, 1));
  stats.shield = Math.min(stats.shieldMax, stats.shield);
  return unlocked;
}
