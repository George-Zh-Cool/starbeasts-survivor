/** 本机解锁。只看这台浏览器的纪录，没有账号。 */
import { formatTime, loadHighScores, loadLocalRuns } from './HighScores';
import { bossKillCount } from './Milestones';
import type { RunModeId } from '../data/modes';
import { isStarterId, type StarterId } from '../data/starters';

const LS_MODE = 'starbeasts_mode';
const LS_STARTER = 'starbeasts_starter';

export type UnlockKind = 'beast' | 'weapon' | 'mode';
export type UnlockMetric = 'time' | 'count';

interface UnlockRule {
  id: string;
  kind: UnlockKind;
  /** 角色 id / 起始武装 id / 模式 id */
  refId: string;
  name: string;
  where: string;
  detail: string;
  metric: UnlockMetric;
  target: number;
  order: number;
  read: (career: Career) => number;
}

export interface Career {
  runs: number;
  bestTimeSec: number;
  bestKills: number;
  bestLevel: number;
  bossKills: number;
}

export interface UnlockView {
  id: string;
  kind: UnlockKind;
  refId: string;
  name: string;
  where: string;
  detail: string;
  metric: UnlockMetric;
  current: number;
  target: number;
  ratio: number;
  unlocked: boolean;
  order: number;
}

const RULES: UnlockRule[] = [
  {
    id: 'mode_sprint',
    kind: 'mode',
    refId: 'sprint',
    name: '短局冲刺',
    where: '大厅的「短局冲刺」卡片',
    detail: '打完 1 局',
    metric: 'count',
    target: 1,
    order: 0,
    read: (c) => c.runs,
  },
  {
    id: 'weapon_riftbow',
    kind: 'weapon',
    refId: 'riftbow',
    name: '裂星弩',
    where: '出战页顶部的「起始武装」',
    detail: '单局击杀达到 28',
    metric: 'count',
    target: 28,
    order: 1,
    read: (c) => c.bestKills,
  },
  {
    id: 'beast_frostmarten',
    kind: 'beast',
    refId: 'frostmarten',
    name: '霜铃貂',
    where: '开始游戏后的出战星兽',
    detail: '单局存活达到 0:50',
    metric: 'time',
    target: 50,
    order: 2,
    read: (c) => c.bestTimeSec,
  },
  {
    id: 'weapon_tidemallet',
    kind: 'weapon',
    refId: 'tidemallet',
    name: '潮鸣锤',
    where: '出战页顶部的「起始武装」',
    detail: '单局等级达到 6',
    metric: 'count',
    target: 6,
    order: 3,
    read: (c) => c.bestLevel,
  },
  {
    id: 'beast_stormlizard',
    kind: 'beast',
    refId: 'stormlizard',
    name: '雷脊蜥',
    where: '开始游戏后的出战星兽',
    detail: '累计击败 1 只 Boss',
    metric: 'count',
    target: 1,
    order: 4,
    read: (c) => c.bossKills,
  },
];

export function loadCareer(): Career {
  const highs = loadHighScores();
  const runs = loadLocalRuns();
  const bestLevel = runs.reduce((max, run) => Math.max(max, run.level), 0);
  const played = runs.length > 0 || highs.bestTimeSec > 0 || highs.bestKills > 0;
  return {
    runs: played ? Math.max(1, runs.length) : 0,
    bestTimeSec: highs.bestTimeSec,
    bestKills: highs.bestKills,
    bestLevel,
    bossKills: bossKillCount(),
  };
}

function toView(rule: UnlockRule, career: Career): UnlockView {
  const current = Math.max(0, rule.read(career));
  const ratio = rule.target <= 0 ? 1 : Math.max(0, Math.min(1, current / rule.target));
  return {
    id: rule.id,
    kind: rule.kind,
    refId: rule.refId,
    name: rule.name,
    where: rule.where,
    detail: rule.detail,
    metric: rule.metric,
    current,
    target: rule.target,
    ratio,
    unlocked: current >= rule.target,
    order: rule.order,
  };
}

export function listUnlocks(career: Career = loadCareer()): UnlockView[] {
  return RULES.map((rule) => toView(rule, career)).sort((a, b) => a.order - b.order);
}

export function unlockIdSet(career: Career = loadCareer()): Set<string> {
  return new Set(listUnlocks(career).filter((item) => item.unlocked).map((item) => item.id));
}

export function newlyUnlocked(before: Set<string>, career: Career = loadCareer()): UnlockView[] {
  return listUnlocks(career).filter((item) => item.unlocked && !before.has(item.id));
}

/** 还没拿到、完成度最高的一档。都是 0 时按顺序给最近的一档。 */
export function nextUnlock(career: Career = loadCareer()): UnlockView | null {
  const locked = listUnlocks(career).filter((item) => !item.unlocked);
  if (locked.length === 0) return null;
  let best = locked[0]!;
  for (const item of locked) {
    if (item.ratio > best.ratio + 0.0001) best = item;
    else if (Math.abs(item.ratio - best.ratio) <= 0.0001 && item.order < best.order) best = item;
  }
  return best;
}

export function formatUnlockProgress(item: UnlockView): string {
  if (item.metric === 'time') {
    return `${formatTime(Math.min(item.current, item.target))} / ${formatTime(item.target)}`;
  }
  return `${Math.min(Math.floor(item.current), item.target)} / ${item.target}`;
}

export function unlockBanner(item: UnlockView): { title: string; body: string } {
  const kind = item.kind === 'beast' ? '星兽' : item.kind === 'weapon' ? '起始武装' : '模式';
  return {
    title: `解锁${kind} · ${item.name}`,
    body: `下一局去${item.where}就能选到。`,
  };
}

export function isBeastUnlocked(characterId: string, career: Career = loadCareer()): boolean {
  const rule = RULES.find((item) => item.kind === 'beast' && item.refId === characterId);
  if (!rule) return true;
  return toView(rule, career).unlocked;
}

export function isStarterUnlocked(starterId: string, career: Career = loadCareer()): boolean {
  if (starterId === 'plain' || starterId === '') return true;
  const rule = RULES.find((item) => item.kind === 'weapon' && item.refId === starterId);
  if (!rule) return false;
  return toView(rule, career).unlocked;
}

export function isModeUnlocked(modeId: string, career: Career = loadCareer()): boolean {
  if (modeId === 'standard') return true;
  const rule = RULES.find((item) => item.kind === 'mode' && item.refId === modeId);
  if (!rule) return false;
  return toView(rule, career).unlocked;
}

export function beastUnlock(characterId: string, career: Career = loadCareer()): UnlockView | null {
  const view = listUnlocks(career).find((item) => item.kind === 'beast' && item.refId === characterId);
  return view ?? null;
}

export function starterUnlock(starterId: string, career: Career = loadCareer()): UnlockView | null {
  return listUnlocks(career).find((item) => item.kind === 'weapon' && item.refId === starterId) ?? null;
}

export function modeUnlock(modeId: string, career: Career = loadCareer()): UnlockView | null {
  return listUnlocks(career).find((item) => item.kind === 'mode' && item.refId === modeId) ?? null;
}

export function loadModeId(): RunModeId {
  try {
    const stored = localStorage.getItem(LS_MODE);
    if (stored === 'sprint' && isModeUnlocked('sprint')) return 'sprint';
  } catch {
    /* ignore */
  }
  return 'standard';
}

export function saveModeId(id: RunModeId): void {
  try {
    localStorage.setItem(LS_MODE, id);
  } catch {
    /* ignore */
  }
}

export function loadStarterId(): StarterId {
  try {
    const stored = localStorage.getItem(LS_STARTER) ?? '';
    if (isStarterId(stored) && isStarterUnlocked(stored)) return stored;
  } catch {
    /* ignore */
  }
  return 'plain';
}

export function saveStarterId(id: StarterId): void {
  try {
    localStorage.setItem(LS_STARTER, id);
  } catch {
    /* ignore */
  }
}
