import { ENEMY_DEFS, ELITE_DEF, enemyScale, type EnemyDef } from '../data/enemies';
import { BALANCE } from '../data/balance';
import { MODES, type SpawnPressure } from '../data/modes';
import { rollAffixForSpawn } from '../data/affixes';
import type { Enemy } from '../entities/Enemy';
import type { ObjectPool } from './ObjectPool';
import type { Player } from '../entities/Player';
import type { ObstacleField } from './Obstacles';
import type * as THREE from 'three';

export class Spawner {
  private timer = 0.6; // 出生保护后稍延迟第一波
  private eliteTimer: number = BALANCE.eliteFirstSec;
  private spawnInterval: number = BALANCE.spawnIntervalBase;
  private readonly pool: ObjectPool<Enemy>;
  private readonly active: Enemy[];
  private readonly scene: THREE.Scene;
  private obstacles: ObstacleField | null = null;
  /** Multiplier from EventDirector (elite tide). */
  rateMul = 1;
  maxBonus = 0;
  /** When boss is alive, slightly reduce background spawn pressure. */
  bossPresent = false;
  private pressure: SpawnPressure = MODES.standard.pressure;

  constructor(scene: THREE.Scene, pool: ObjectPool<Enemy>, active: Enemy[]) {
    this.scene = scene;
    this.pool = pool;
    this.active = active;
  }

  setObstacles(field: ObstacleField | null): void {
    this.obstacles = field;
  }

  setPressure(pressure: SpawnPressure): void {
    this.pressure = pressure;
  }

  reset(): void {
    this.timer = 0.6;
    this.eliteTimer = this.pressure.eliteFirstSec;
    this.spawnInterval = BALANCE.spawnIntervalBase;
    this.rateMul = 1;
    this.maxBonus = 0;
    this.bossPresent = false;
  }

  update(dt: number, timeSec: number, player: Player): void {
    const B = BALANCE;
    this.spawnInterval = Math.max(B.spawnIntervalMin, B.spawnIntervalBase - timeSec * B.spawnIntervalDecay);
    const interval = (this.spawnInterval * this.pressure.intervalMul) / Math.max(0.25, this.rateMul);
    let maxEnemies = Math.min(
      B.maxEnemiesCap,
      Math.round((B.maxEnemiesBase + Math.floor(timeSec * B.maxEnemiesPerSec)) * this.pressure.capMul) + this.maxBonus,
    );
    if (this.bossPresent) maxEnemies = Math.min(maxEnemies, B.maxEnemiesBossCap);

    this.timer -= dt;
    while (this.timer <= 0 && this.active.length < maxEnemies) {
      this.timer += interval;
      const burst =
        1 + (timeSec > B.burstAtSec[0] ? 1 : 0) + (timeSec > B.burstAtSec[1] ? 1 : 0);
      for (let i = 0; i < burst && this.active.length < maxEnemies; i++) {
        this.spawnOne(player, timeSec, false);
      }
    }

    this.eliteTimer -= dt;
    if (this.eliteTimer <= 0) {
      this.eliteTimer = (B.eliteIntervalMin + Math.random() * B.eliteIntervalRand) * this.pressure.eliteIntervalMul;
      if (this.active.length < maxEnemies) this.spawnOne(player, timeSec, true);
    }
  }

  private pickDef(timeSec: number): EnemyDef {
    const roll = Math.random();
    if (timeSec >= 50 && roll < 0.18) return ENEMY_DEFS.embermoth;
    if (timeSec >= 85 && roll < 0.3) return ENEMY_DEFS.rockcrab;
    const defs = Object.values(ENEMY_DEFS).filter((d) => d.weight > 0);
    const total = defs.reduce((s, d) => s + d.weight, 0);
    let r = Math.random() * total;
    for (const d of defs) {
      r -= d.weight;
      if (r <= 0) return d;
    }
    return defs[0];
  }

  /**
   * 在玩家周围环形区域找不与障碍重叠的点；失败则返回最后一次尝试。
   */
  findSafeAround(
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
      if (!this.obstacles || !this.obstacles.isBlocked(x, z, radius)) {
        return { x, z };
      }
    }
    if (this.obstacles) {
      for (let k = 0; k < 6; k++) {
        const angle = Math.random() * Math.PI * 2;
        const x = cx + Math.cos(angle) * (distMax + 4 + k);
        const z = cz + Math.sin(angle) * (distMax + 4 + k);
        if (!this.obstacles.isBlocked(x, z, radius)) return { x, z };
      }
    }
    return last;
  }

  private spawnOne(player: Player, timeSec: number, elite: boolean): void {
    const def = elite ? ELITE_DEF : this.pickDef(timeSec);
    const scale = enemyScale(timeSec);
    const pos = this.findSafeAround(
      player.position.x,
      player.position.z,
      18,
      26,
      def.radius,
      16,
    );
    const affix = rollAffixForSpawn(elite, def.kind, timeSec);
    const enemy = this.pool.acquire();
    if (!enemy.mesh.parent) this.scene.add(enemy.mesh);
    enemy.spawn(def, pos.x, pos.z, scale.hpMul, scale.speedMul, scale.dmgMul, affix);
    this.active.push(enemy);
  }

  /** 死亡分裂 / 外部召唤 */
  spawnSplitlings(
    from: Enemy,
    count: number,
    timeSec: number,
  ): void {
    const scale = enemyScale(timeSec);
    const baseDef =
      from.kind === 'elite'
        ? ENEMY_DEFS.riftwolf
        : ENEMY_DEFS[from.kind as keyof typeof ENEMY_DEFS] ?? ENEMY_DEFS.darkcrystal;
    for (let i = 0; i < count; i++) {
      if (this.active.length >= 230) break;
      const pos = this.findSafeAround(from.mesh.position.x, from.mesh.position.z, 0.8, 2.2, baseDef.radius * 0.7, 10);
      const enemy = this.pool.acquire();
      if (!enemy.mesh.parent) this.scene.add(enemy.mesh);
      enemy.spawn(baseDef, pos.x, pos.z, scale.hpMul, scale.speedMul, scale.dmgMul, null, {
        isSplitling: true,
        hpScale: 0.4,
        sizeScale: 0.7,
      });
      this.active.push(enemy);
    }
  }
}
