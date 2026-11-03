const LS_BEST_TIME = 'starbeasts_best_time';
const LS_BEST_KILLS = 'starbeasts_best_kills';

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
