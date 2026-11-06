/** 局模式。标准是默认生存；短局冲刺改压力和时长目标。 */
import { BALANCE } from './balance';
import type { CharacterDef } from './characters';

export type RunModeId = 'standard' | 'sprint';

export interface SpawnPressure {
  /** 乘在刷怪间隔上，小于 1 更密 */
  intervalMul: number;
  /** 乘在同时在场上限上 */
  capMul: number;
  eliteFirstSec: number;
  eliteIntervalMul: number;
}

export interface RunMode {
  id: RunModeId;
  name: string;
  blurb: string;
  /** 0 表示不设时长，撑到倒下为止 */
  goalSec: number;
  pressure: SpawnPressure;
}

export const SPRINT_GOAL_SEC = 90;

export const MODES: Record<RunModeId, RunMode> = {
  standard: {
    id: 'standard',
    name: '标准突围',
    blurb: '石砖暗潮，撑得越久越好',
    goalSec: 0,
    pressure: {
      intervalMul: 1,
      capMul: 1,
      eliteFirstSec: BALANCE.eliteFirstSec,
      eliteIntervalMul: 1,
    },
  },
  sprint: {
    id: 'sprint',
    name: '短局冲刺',
    blurb: '刷怪更密，90 秒收场，撑到点算过关',
    goalSec: SPRINT_GOAL_SEC,
    pressure: {
      intervalMul: 0.62,
      capMul: 1.38,
      eliteFirstSec: 16,
      eliteIntervalMul: 0.62,
    },
  },
};

export function getMode(id: RunModeId): RunMode {
  return MODES[id];
}

export interface RunSetup {
  character: CharacterDef;
  modeId: RunModeId;
  starterId: string;
}
