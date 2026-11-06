const LS_BEST_TIME = 'starbeasts_best_time';
const LS_BEST_KILLS = 'starbeasts_best_kills';
const LS_RUNS = 'starbeasts_local_runs';
const LS_PREFERRED = 'starbeasts_preferred';
const MAX_RUNS = 24;

export interface HighScores {
  bestTimeSec: number;
  bestKills: number;
}

function readNum(key: string): number {
  try {
    const v = localStorage.getItem(key);
    if (v === null) return 0;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

function writeNum(key: string, n: number): void {
  try {
    localStorage.setItem(key, String(Math.floor(n)));
  } catch {
    /* ignore */
  }
}

export function loadHighScores(): HighScores {
  return {
    bestTimeSec: readNum(LS_BEST_TIME),
    bestKills: readNum(LS_BEST_KILLS),
  };
}

/** Update records if this run beats them. Returns the (possibly updated) scores and flags. */
export function submitRun(timeSec: number, kills: number): HighScores & {
  newBestTime: boolean;
  newBestKills: boolean;
} {
  const prev = loadHighScores();
  const newBestTime = timeSec > prev.bestTimeSec;
  const newBestKills = kills > prev.bestKills;
  const bestTimeSec = newBestTime ? timeSec : prev.bestTimeSec;
  const bestKills = newBestKills ? kills : prev.bestKills;
  if (newBestTime) writeNum(LS_BEST_TIME, bestTimeSec);
  if (newBestKills) writeNum(LS_BEST_KILLS, bestKills);
  return { bestTimeSec, bestKills, newBestTime, newBestKills };
}

export function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** One finished run stored only in this browser. */
export interface LocalRun {
  at: number;
  timeSec: number;
  kills: number;
  level: number;
  characterId: string;
  characterName: string;
  modeName?: string;
  victory?: boolean;
}

export function loadLocalRuns(): LocalRun[] {
  try {
    const raw = localStorage.getItem(LS_RUNS);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const runs: LocalRun[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const r = item as Partial<LocalRun>;
      const timeSec = Number(r.timeSec);
      const kills = Number(r.kills);
      const level = Number(r.level);
      const at = Number(r.at);
      if (!Number.isFinite(timeSec) || timeSec < 0) continue;
      if (!Number.isFinite(kills) || kills < 0) continue;
      const characterName = typeof r.characterName === 'string' ? r.characterName.trim() : '';
      runs.push({
        at: Number.isFinite(at) && at > 0 ? at : 0,
        timeSec,
        kills: Math.floor(kills),
        level: Number.isFinite(level) && level > 0 ? Math.floor(level) : 1,
        characterId: typeof r.characterId === 'string' ? r.characterId : '',
        characterName: characterName || '星兽',
        modeName: typeof r.modeName === 'string' ? r.modeName : undefined,
        victory: r.victory === true,
      });
    }
    return runs.slice(0, MAX_RUNS);
  } catch {
    return [];
  }
}

export function recordLocalRun(run: Omit<LocalRun, 'at'>): void {
  const next: LocalRun = {
    at: Date.now(),
    timeSec: Math.max(0, run.timeSec),
    kills: Math.max(0, Math.floor(run.kills)),
    level: Math.max(1, Math.floor(run.level) || 1),
    characterId: run.characterId,
    characterName: run.characterName || '星兽',
    modeName: run.modeName,
    victory: run.victory,
  };
  const prev = loadLocalRuns();
  prev.unshift(next);
  try {
    localStorage.setItem(LS_RUNS, JSON.stringify(prev.slice(0, MAX_RUNS)));
  } catch {
    /* ignore quota / private mode */
  }
}

export function loadPreferredId(): string {
  try {
    return localStorage.getItem(LS_PREFERRED) ?? '';
  } catch {
    return '';
  }
}

export function savePreferredId(id: string): void {
  try {
    localStorage.setItem(LS_PREFERRED, id);
  } catch {
    /* ignore */
  }
}
