import { BOSS_CORE, BOSS_HORN, BOSS_ROSTER, bossScale, type BossDef } from '../data/bosses';
import { BALANCE } from '../data/balance';
import { ELITE_DEF, ENEMY_DEFS, enemyScale, type EnemyDef } from '../data/enemies';
import type { Boss } from '../entities/Boss';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import type { ObjectPool } from './ObjectPool';
import type { ObstacleField } from './Obstacles';
import { rollAffixForSpawn } from '../data/affixes';
import type * as THREE from 'three';

export type EventKind = 'boss' | 'elite_tide';

export interface ScheduledEvent {
  atSec: number;
  kind: EventKind;
  bossIndex?: number;
  label: string;
}

export interface EventHooks {
  onBossWarn: (name: string) => void;
  onEliteTide: () => void;
  onBossSpawned: (boss: Boss) => void;
  onBossDefeated: (bossName: string, xp: number) => void;
}

/**
 * Fixed-time event schedule:
 *  60s  Boss 裂空巨角
 *  90s  精英潮
 * 120s  Boss 星环邪核
 * 150s  精英潮
 * then every 30s alternate scaled boss / elite tide
 */
export class EventDirector {
  private readonly scene: THREE.Scene;
  private readonly enemyPool: ObjectPool<Enemy>;
  private readonly enemies: Enemy[];
  private readonly boss: Boss;
  private hooks: EventHooks | null = null;

  private schedule: ScheduledEvent[] = [];
  private nextIdx = 0;
  private eliteTideTimer = 0;
  private eliteTideActive = false;
  private fired = new Set<number>();
  private pendingDefeatName = '';
  private pendingDefeatXp = 0;
  private obstacles: ObstacleField | null = null;

  constructor(scene: THREE.Scene, enemyPool: ObjectPool<Enemy>, enemies: Enemy[], boss: Boss) {
    this.scene = scene;
    this.enemyPool = enemyPool;
    this.enemies = enemies;
    this.boss = boss;
  }

  setHooks(hooks: EventHooks): void {
    this.hooks = hooks;
  }

  setObstacles(field: ObstacleField | null): void {
    this.obstacles = field;
  }

  private findSafe(
    cx: number,
    cz: number,
    distMin: number,
    distMax: number,
    radius: number,
    retries = 14,
  ): { x: number; z: number } {
    let last = { x: cx + distMin, z: cz };
    for (let i = 0; i < retries; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = distMin + Math.random() * Math.max(0.1, distMax - distMin);
      const x = cx + Math.cos(angle) * dist;
      const z = cz + Math.sin(angle) * dist;
      last = { x, z };
      if (!this.obstacles || !this.obstacles.isBlocked(x, z, radius)) return { x, z };
    }
    if (this.obstacles) {
      for (let k = 0; k < 6; k++) {
        const angle = Math.random() * Math.PI * 2;
        const x = cx + Math.cos(angle) * (distMax + 3 + k * 1.5);
        const z = cz + Math.sin(angle) * (distMax + 3 + k * 1.5);
        if (!this.obstacles.isBlocked(x, z, radius)) return { x, z };
      }
    }
    return last;
  }

  reset(): void {
    this.nextIdx = 0;
    this.eliteTideTimer = 0;
    this.eliteTideActive = false;
    this.fired.clear();
    this.pendingDefeatName = '';
    this.pendingDefeatXp = 0;
    if (this.boss.active) {
      this.boss.despawn();
    }
    if (this.boss.group.parent) {
      this.scene.remove(this.boss.group);
    }
    if (this.boss.fxRoot.parent) {
      this.scene.remove(this.boss.fxRoot);
    }
    this.schedule = this.buildSchedule();
  }

  private buildSchedule(): ScheduledEvent[] {
    const list: ScheduledEvent[] = [
      { atSec: 60, kind: 'boss', bossIndex: 0, label: BOSS_HORN.name },
      { atSec: 90, kind: 'elite_tide', label: '精英潮' },
      { atSec: 120, kind: 'boss', bossIndex: 1, label: BOSS_CORE.name },
      { atSec: 150, kind: 'elite_tide', label: '精英潮' },
    ];
    let t = 180;
    let bossFlip = 0;
    for (let i = 0; i < 12; i++) {
      if (i % 2 === 0) {
        const def = BOSS_ROSTER[bossFlip % BOSS_ROSTER.length];
        list.push({
          atSec: t,
          kind: 'boss',
          bossIndex: bossFlip % BOSS_ROSTER.length,
          label: def.name,
        });
        bossFlip += 1;
      } else {
        list.push({ atSec: t, kind: 'elite_tide', label: '精英潮' });
      }
      t += 30;
    }
    return list;
  }

  get isEliteTide(): boolean {
    return this.eliteTideActive;
  }

  get activeBoss(): Boss | null {
    return this.boss.active ? this.boss : null;
  }

  get spawnRateMul(): number {
    return this.eliteTideActive ? BALANCE.eliteTideRateMul : 1;
  }

  get maxEnemyBonus(): number {
    return this.eliteTideActive ? BALANCE.eliteTideMaxBonus : 0;
  }

  update(dt: number, timeSec: number, player: Player): void {
    if (this.eliteTideActive) {
      this.eliteTideTimer -= dt;
      if (this.eliteTideTimer <= 0) {
        this.eliteTideActive = false;
      } else if (Math.random() < dt * 4.5) {
        this.spawnTideEnemy(player, timeSec, false);
      }
    }

    while (this.nextIdx < this.schedule.length && timeSec >= this.schedule[this.nextIdx].atSec) {
      const ev = this.schedule[this.nextIdx];
      this.nextIdx += 1;
      if (this.fired.has(ev.atSec)) continue;
      this.fired.add(ev.atSec);
      this.trigger(ev, player, timeSec);
    }
  }

  /** Call after boss.takeDamage returns true. */
  notifyBossDefeated(): void {
    const name = this.pendingDefeatName || 'Boss';
    const xp = this.pendingDefeatXp || 80;
    this.pendingDefeatName = '';
    this.pendingDefeatXp = 0;
    this.hooks?.onBossDefeated(name, xp);
  }

  private trigger(ev: ScheduledEvent, player: Player, timeSec: number): void {
    if (ev.kind === 'elite_tide') {
      this.eliteTideActive = true;
      this.eliteTideTimer = BALANCE.eliteTideDuration;
      this.hooks?.onEliteTide();
      for (let i = 0; i < BALANCE.eliteTideInitialBurst; i++) this.spawnTideEnemy(player, timeSec, true);
      return;
    }

    if (this.boss.active) return;
    const def = BOSS_ROSTER[ev.bossIndex ?? 0] ?? BOSS_HORN;
    this.spawnBoss(def, player, timeSec);
  }

  private spawnBoss(def: BossDef, player: Player, timeSec: number): void {
    const scale = bossScale(timeSec);
    const angle = Math.random() * Math.PI * 2;
    const dist = 22;
    const x = player.position.x + Math.cos(angle) * dist;
    const z = player.position.z + Math.sin(angle) * dist;
    if (!this.boss.group.parent) this.scene.add(this.boss.group);
    if (!this.boss.fxRoot.parent) this.scene.add(this.boss.fxRoot);
    this.boss.spawn(def, x, z, scale.hpMul, scale.speedMul, scale.dmgMul);
    this.pendingDefeatName = def.name;
    this.pendingDefeatXp = Math.floor(def.xp * (1 + Math.floor(timeSec / 60) * 0.25));
    this.boss.xp = this.pendingDefeatXp;
    this.hooks?.onBossWarn(def.name);
    this.hooks?.onBossSpawned(this.boss);
  }

  private spawnTideEnemy(player: Player, timeSec: number, preferElite: boolean): void {
    if (this.enemies.length >= 240) return;
    const scale = enemyScale(timeSec);
    const roll = Math.random();
    let def: EnemyDef = ENEMY_DEFS.darkcrystal;
    let hpM = 1.1;
    let spM = 1.1;
    let forceElite = false;
    if (preferElite && roll < 0.25) {
      def = ELITE_DEF;
      hpM = 0.7;
      spM = 1;
      forceElite = true;
    } else if (roll < 0.12) {
      def = ELITE_DEF;
      hpM = 0.55;
      spM = 1;
      forceElite = true;
    } else if (roll < 0.4) {
      def = ENEMY_DEFS.voidbeetle;
      hpM = 1.1;
      spM = 1.05;
    } else if (roll < 0.7) {
      def = ENEMY_DEFS.riftwolf;
      hpM = 1.1;
      spM = 1.15;
    }
    const pos = this.findSafe(player.position.x, player.position.z, 16, 22, def.radius, 16);
    const affix = rollAffixForSpawn(forceElite || def.kind === 'elite', def.kind, timeSec);
    const enemy = this.enemyPool.acquire();
    if (!enemy.mesh.parent) this.scene.add(enemy.mesh);
    enemy.spawn(def, pos.x, pos.z, scale.hpMul * hpM, scale.speedMul * spM, scale.dmgMul, affix);
    this.enemies.push(enemy);
  }

  spawnMinions(aroundX: number, aroundZ: number, count: number, timeSec: number): void {
    const scale = enemyScale(timeSec);
    for (let i = 0; i < count; i++) {
      if (this.enemies.length >= 240) break;
      const def = i % 2 === 0 ? ENEMY_DEFS.riftwolf : ENEMY_DEFS.darkcrystal;
      const pos = this.findSafe(aroundX, aroundZ, 2.5, 5.5, def.radius, 14);
      const enemy = this.enemyPool.acquire();
      if (!enemy.mesh.parent) this.scene.add(enemy.mesh);
      enemy.spawn(def, pos.x, pos.z, scale.hpMul, scale.speedMul, scale.dmgMul, null);
      this.enemies.push(enemy);
    }
  }
}
