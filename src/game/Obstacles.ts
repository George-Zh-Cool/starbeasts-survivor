import * as THREE from 'three';
import { makeGroundRing, makeShadow } from '../visual/pixelScene';
import { propVisual } from '../visual/sprites';

export type ObstacleKind = 'rock' | 'crystal';

export interface Obstacle {
  id: number;
  kind: ObstacleKind;
  /** 可破坏晶体；岩石恒为 Infinity */
  hp: number;
  maxHp: number;
  radius: number;
  x: number;
  z: number;
  active: boolean;
  mesh: THREE.Group;
}

let nextId = 1;

/**
 * 战场障碍：岩石（不可破坏，挡投射物）+ 晶体（可被投射物 / Boss 冲撞打碎）。
 * 圆形 XZ 碰撞，开局随机布局并避开出生点。
 */
export class ObstacleField {
  readonly obstacles: Obstacle[] = [];
  private readonly scene: THREE.Scene;
  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /** 每局重新随机生成 */
  regenerate(opts?: { count?: number; clearRadius?: number; arena?: number }): void {
    this.clear();
    const count = opts?.count ?? 14 + Math.floor(Math.random() * 6);
    const clearR = opts?.clearRadius ?? 5.5;
    const arena = opts?.arena ?? 34;
    let attempts = 0;
    while (this.obstacles.length < count && attempts < count * 40) {
      attempts += 1;
      const ang = Math.random() * Math.PI * 2;
      const dist = clearR + 2 + Math.random() * (arena - clearR - 2);
      const x = Math.cos(ang) * dist;
      const z = Math.sin(ang) * dist;
      const kind: ObstacleKind = Math.random() < 0.45 ? 'crystal' : 'rock';
      const radius = kind === 'rock' ? 0.85 + Math.random() * 0.55 : 0.55 + Math.random() * 0.4;
      if (Math.hypot(x, z) < clearR + radius) continue;
      if (this.overlapsExisting(x, z, radius + 1.1)) continue;
      this.spawnOne(kind, x, z, radius);
    }
  }

  private overlapsExisting(x: number, z: number, minDist: number): boolean {
    for (const o of this.obstacles) {
      if (!o.active) continue;
      const dx = o.x - x;
      const dz = o.z - z;
      if (dx * dx + dz * dz < minDist * minDist) return true;
    }
    return false;
  }

  private spawnOne(kind: ObstacleKind, x: number, z: number, radius: number): Obstacle {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    if (kind === 'rock') {
      this.buildRock(group, radius);
    } else {
      this.buildCrystal(group, radius);
    }

    const o: Obstacle = {
      id: nextId++,
      kind,
      hp: kind === 'crystal' ? 28 + Math.floor(Math.random() * 18) : Infinity,
      maxHp: kind === 'crystal' ? 40 : Infinity,
      radius,
      x,
      z,
      active: true,
      mesh: group,
    };
    if (kind === 'crystal') {
      o.maxHp = o.hp;
    }
    this.obstacles.push(o);
    this.scene.add(group);
    return o;
  }

  private buildBillboard(group: THREE.Group, kind: 'rock' | 'crystal', radius: number): THREE.SpriteMaterial {
    const vis = propVisual(kind);
    const mat = new THREE.SpriteMaterial({
      map: vis.texture,
      transparent: true,
      alphaTest: 0.2,
      depthWrite: true,
      toneMapped: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.center.set(0.5, 0);
    sprite.renderOrder = 2;
    const h = radius * (kind === 'rock' ? 2.05 : 2.45);
    sprite.scale.set(h * vis.aspect, h, 1);
    group.add(makeShadow(Math.max(0.7, h * vis.aspect * 0.72)));
    group.add(sprite);
    if (kind === 'crystal') {
      group.add(makeGroundRing(radius * 1.05, 0x7ee7f5, 0.28));
    }
    return mat;
  }

  private buildRock(group: THREE.Group, radius: number): void {
    this.buildBillboard(group, 'rock', radius);
  }

  private buildCrystal(group: THREE.Group, radius: number): void {
    const mat = this.buildBillboard(group, 'crystal', radius);
    group.userData.crystalMat = mat;
  }

  clear(): void {
    for (const o of this.obstacles) {
      this.disposeObstacle(o);
    }
    this.obstacles.length = 0;
  }

  private disposeObstacle(o: Obstacle): void {
    if (o.mesh.parent) o.mesh.parent.remove(o.mesh);
    o.mesh.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        const m = obj.material;
        if (Array.isArray(m)) m.forEach((x) => x.dispose());
        else m.dispose();
      } else if (obj instanceof THREE.Sprite) {
        const m = obj.material;
        if (Array.isArray(m)) m.forEach((x) => x.dispose());
        else m.dispose();
      }
    });
    o.active = false;
  }

  /** 将圆形实体推出障碍重叠区（就地修改 pos） */
  resolveCircle(pos: { x: number; z: number }, radius: number): void {
    for (const o of this.obstacles) {
      if (!o.active) continue;
      const dx = pos.x - o.x;
      const dz = pos.z - o.z;
      const min = radius + o.radius;
      const d2 = dx * dx + dz * dz;
      if (d2 >= min * min || d2 < 1e-8) {
        if (d2 < 1e-8) {
          // 完全重合：沿随机方向推开
          pos.x += min * 0.5;
        }
        continue;
      }
      const d = Math.sqrt(d2);
      const push = (min - d) / d;
      pos.x += dx * push;
      pos.z += dz * push;
    }
  }

  /**
   * 投射物 vs 障碍。
   * 岩石：挡弹并销毁投射物；晶体：扣血，可打碎。
   * @returns 'block' | 'break' | null
   */
  hitProjectile(
    x: number,
    z: number,
    projRadius: number,
    damage: number,
  ): { result: 'block' | 'break'; obstacle: Obstacle } | null {
    for (const o of this.obstacles) {
      if (!o.active) continue;
      const dx = o.x - x;
      const dz = o.z - z;
      const rr = o.radius + projRadius;
      if (dx * dx + dz * dz > rr * rr) continue;
      if (o.kind === 'rock') {
        return { result: 'block', obstacle: o };
      }
      o.hp -= damage;
      this.flashCrystal(o);
      if (o.hp <= 0) {
        o.active = false;
        return { result: 'break', obstacle: o };
      }
      return { result: 'block', obstacle: o };
    }
    return null;
  }

  /** Boss 冲撞：打碎半径内所有晶体，岩石被轻微推开视觉抖动 */
  smashInRadius(
    x: number,
    z: number,
    radius: number,
  ): { broken: Obstacle[]; rocked: Obstacle[] } {
    const broken: Obstacle[] = [];
    const rocked: Obstacle[] = [];
    for (const o of this.obstacles) {
      if (!o.active) continue;
      const dx = o.x - x;
      const dz = o.z - z;
      const rr = radius + o.radius;
      if (dx * dx + dz * dz > rr * rr) continue;
      if (o.kind === 'crystal') {
        o.hp = 0;
        o.active = false;
        broken.push(o);
      } else {
        rocked.push(o);
        // 岩石抖动反馈
        o.mesh.rotation.y += 0.35;
        o.mesh.position.y = 0.08;
      }
    }
    return { broken, rocked };
  }

  /** 每帧收尾：移除已打碎网格、岩石回落 */
  update(dt: number): void {
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const o = this.obstacles[i];
      if (!o.active) {
        this.disposeObstacle(o);
        this.obstacles.splice(i, 1);
        continue;
      }
      if (o.kind === 'rock' && o.mesh.position.y > 0) {
        o.mesh.position.y = Math.max(0, o.mesh.position.y - dt * 0.6);
      }
      if (o.kind === 'crystal') {
        const flash = (o.mesh.userData.flash as number) || 0;
        const next = Math.max(0, flash - dt);
        o.mesh.userData.flash = next;
        const mat = o.mesh.userData.crystalMat as THREE.SpriteMaterial | undefined;
        if (mat) {
          const hot = next > 0 ? 1.8 : 1;
          mat.color.setRGB(hot, hot, hot);
        }
      }
    }
  }

  private flashCrystal(o: Obstacle): void {
    o.mesh.userData.flash = 0.16;
    const ratio = Math.max(0.35, o.hp / o.maxHp);
    o.mesh.scale.setScalar(0.85 + ratio * 0.15);
  }

  /** 刷怪点是否太靠近障碍 */
  isBlocked(x: number, z: number, radius: number): boolean {
    for (const o of this.obstacles) {
      if (!o.active) continue;
      const dx = o.x - x;
      const dz = o.z - z;
      const min = o.radius + radius + 0.4;
      if (dx * dx + dz * dz < min * min) return true;
    }
    return false;
  }
}
