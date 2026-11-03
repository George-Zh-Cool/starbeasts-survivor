import * as THREE from 'three';
import type { BossDef, BossPattern } from '../data/bosses';
import { buildBossCore, buildBossHorn, stdMat } from '../visual/builders';
import { getBossTexture } from '../visual/textures';

export type BossAction =
  | { type: 'ring'; count: number; speed: number; damage: number; color: number }
  | { type: 'summon'; count: number }
  | null;

type Ghost = {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
};

const MAX_GHOSTS = 10;

export class Boss {
  readonly group: THREE.Group;
  /** 残影挂在场景根，不跟随 Boss 位移 */
  readonly fxRoot: THREE.Group;
  readonly body: THREE.Mesh;
  private readonly mat: THREE.MeshStandardMaterial;
  private readonly accentMat: THREE.MeshStandardMaterial;
  private accentParts: THREE.Object3D[] = [];
  private hpBarBg: THREE.Mesh | null = null;
  private hpBarFill: THREE.Mesh | null = null;
  private animTime = 0;
  private attackFlash = 0;
  private ghosts: Ghost[] = [];
  private ghostCooldown = 0;
  private phaseGhostArmed = false;

  active = false;
  def: BossDef | null = null;
  hp = 0;
  maxHp = 0;
  speed = 0;
  contactDamage = 0;
  xp = 0;
  radius = 1.5;
  hitFlash = 0;

  private patternIdx = 0;
  private patternTimer = 0;
  private chargeTimer = 0;
  private charging = false;

  get isCharging(): boolean {
    return this.charging;
  }
  private chargeDir = new THREE.Vector3();
  private restTimer = 1.2;
  private phase = 0;

  constructor() {
    this.group = new THREE.Group();
    this.fxRoot = new THREE.Group();
    this.mat = stdMat(0xff4d6d, { ei: 0.45, rough: 0.4, metal: 0.35 });
    this.accentMat = stdMat(0xffd166, { ei: 0.65, rough: 0.35, metal: 0.3 });
    this.body = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), this.mat);
    this.body.castShadow = true;
    this.group.add(this.body);
    this.group.visible = false;
  }

  spawn(def: BossDef, x: number, z: number, hpMul: number, speedMul: number, dmgMul: number): void {
    this.clearAccents();
    this.clearGhosts();
    this.active = true;
    this.def = def;
    this.radius = def.radius;
    this.maxHp = def.baseHp * hpMul;
    this.hp = this.maxHp;
    this.speed = def.baseSpeed * speedMul;
    this.contactDamage = def.contactDamage * dmgMul;
    this.xp = def.xp;
    this.hitFlash = 0;
    this.attackFlash = 0;
    this.patternIdx = 0;
    this.patternTimer = 1.5;
    this.chargeTimer = 0;
    this.charging = false;
    this.restTimer = 0.8;
    this.phase = 0;
    this.animTime = 0;
    this.ghostCooldown = 0;
    this.phaseGhostArmed = false;
    this.group.visible = true;
    this.group.position.set(x, 0, z);

    this.body.geometry.dispose();
    this.body.scale.set(1, 1, 1);

    this.mat.color.setHex(def.color);
    this.mat.emissive.setHex(def.color);
    this.accentMat.color.setHex(def.accent);
    this.accentMat.emissive.setHex(def.accent);

    const plate = getBossTexture(def.color, def.accent);
    this.mat.map = plate;
    this.mat.needsUpdate = true;
    this.accentMat.map = plate;
    this.accentMat.needsUpdate = true;

    if (def.shape === 'horn') {
      const built = buildBossHorn(def.radius, this.mat, this.accentMat);
      this.body.geometry = built.bodyGeo;
      this.body.position.y = built.bodyY;
      this.body.scale.set(1.15, 1, 1.25);
      for (const p of built.parts) {
        this.group.add(p);
        this.accentParts.push(p);
      }
    } else {
      const built = buildBossCore(def.radius, this.mat, this.accentMat);
      this.body.geometry = built.bodyGeo;
      this.body.position.y = built.bodyY;
      for (const p of built.parts) {
        this.group.add(p);
        this.accentParts.push(p);
      }
    }

    this.ensureHpBar();
    this.updateHpBar();
  }

  private clearAccents(): void {
    for (const m of this.accentParts) {
      this.group.remove(m);
      m.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          const mat = obj.material;
          if (mat !== this.mat && mat !== this.accentMat) {
            if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
            else mat.dispose();
          }
        }
      });
    }
    this.accentParts = [];
  }

  private clearGhosts(): void {
    for (const g of this.ghosts) {
      this.fxRoot.remove(g.mesh);
      (g.mesh.material as THREE.Material).dispose();
      // geometry 与 body 共享，不 dispose
    }
    this.ghosts.length = 0;
  }

  private spawnGhost(opts?: { opacity?: number; scale?: number; life?: number; offsetX?: number; offsetZ?: number }): void {
    while (this.ghosts.length >= MAX_GHOSTS) {
      const old = this.ghosts.shift()!;
      this.fxRoot.remove(old.mesh);
      (old.mesh.material as THREE.Material).dispose();
    }
    const color = this.def?.accent ?? 0xffd166;
    const baseOp = opts?.opacity ?? 0.35;
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: baseOp,
      depthWrite: false,
    });
    mat.userData.baseOp = baseOp;
    const mesh = new THREE.Mesh(this.body.geometry, mat);
    mesh.scale.copy(this.body.scale);
    if (opts?.scale) mesh.scale.multiplyScalar(opts.scale);
    mesh.rotation.copy(this.body.rotation);
    // 世界坐标：group 位姿 + body 本地
    const wx = this.group.position.x + (opts?.offsetX ?? 0);
    const wz = this.group.position.z + (opts?.offsetZ ?? 0);
    mesh.position.set(wx, this.body.position.y, wz);
    mesh.rotation.y = this.body.rotation.y;
    this.fxRoot.add(mesh);
    const maxLife = opts?.life ?? 0.28;
    this.ghosts.push({ mesh, life: maxLife, maxLife });
  }

  private updateGhosts(dt: number): void {
    this.ghostCooldown = Math.max(0, this.ghostCooldown - dt);

    if (this.charging && this.def?.shape === 'horn') {
      if (this.ghostCooldown <= 0) {
        this.spawnGhost({ opacity: 0.4, life: 0.32 });
        this.ghostCooldown = 0.055;
      }
    }

    // 星环邪核：攻击闪色时留下相位残像
    if (this.def?.shape === 'core' && this.attackFlash > 0.4 && !this.phaseGhostArmed) {
      this.phaseGhostArmed = true;
      this.spawnGhost({ opacity: 0.3, scale: 1.08, life: 0.4, offsetX: 0.35 });
      this.spawnGhost({ opacity: 0.22, scale: 0.92, life: 0.35, offsetX: -0.4, offsetZ: 0.2 });
    }
    if (this.attackFlash <= 0) this.phaseGhostArmed = false;

    for (let i = this.ghosts.length - 1; i >= 0; i--) {
      const g = this.ghosts[i];
      g.life -= dt;
      const t = Math.max(0, g.life / g.maxLife);
      const m = g.mesh.material as THREE.MeshBasicMaterial;
      m.opacity = t * (m.userData.baseOp ?? 0.35);
      g.mesh.scale.multiplyScalar(1 + dt * 0.35);
      if (g.life <= 0) {
        this.fxRoot.remove(g.mesh);
        m.dispose();
        this.ghosts.splice(i, 1);
      }
    }
  }

  private ensureHpBar(): void {
    if (this.hpBarBg) return;
    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 0.18),
      new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.7, depthWrite: false }),
    );
    bg.position.y = 4.2;
    const fill = new THREE.Mesh(
      new THREE.PlaneGeometry(3.0, 0.12),
      new THREE.MeshBasicMaterial({ color: 0xff4d6d, depthWrite: false }),
    );
    fill.position.set(0, 4.2, 0.01);
    this.group.add(bg);
    this.group.add(fill);
    this.hpBarBg = bg;
    this.hpBarFill = fill;
  }

  private updateHpBar(): void {
    if (!this.hpBarFill || !this.hpBarBg) return;
    const r = this.maxHp > 0 ? Math.max(0, this.hp / this.maxHp) : 0;
    this.hpBarFill.scale.x = Math.max(0.001, r);
    this.hpBarFill.position.x = -1.5 * (1 - r);
    this.hpBarBg.position.y = this.radius * 2.55 + 0.7;
    this.hpBarFill.position.y = this.hpBarBg.position.y;
  }

  update(dt: number, targetX: number, targetZ: number): BossAction {
    if (!this.active || !this.def) return null;
    this.animTime += dt;
    if (this.attackFlash > 0) this.attackFlash -= dt;

    const dx = targetX - this.group.position.x;
    const dz = targetZ - this.group.position.z;
    const dist = Math.hypot(dx, dz) || 1;
    const nx = dx / dist;
    const nz = dz / dist;

    this.body.rotation.y = Math.atan2(nx, nz);
    if (this.def.shape === 'core') {
      this.body.rotation.y += dt * 1.2;
      this.body.position.y = this.radius + Math.sin(this.animTime * 2.2) * 0.12;
      for (const p of this.accentParts) {
        if (p instanceof THREE.Mesh && p.geometry.type === 'TorusGeometry') {
          p.rotation.z += dt * 1.5;
          p.rotation.x += dt * 0.4;
        } else if (p instanceof THREE.Mesh && p.geometry.type === 'TetrahedronGeometry') {
          p.rotation.y += dt * 2;
          p.position.y += Math.sin(this.animTime * 3 + p.position.x) * 0.002;
        }
      }
    } else {
      this.body.scale.y = 1 + Math.sin(this.animTime * 2.5) * 0.03;
      for (const p of this.accentParts) {
        if (p instanceof THREE.Mesh && p.geometry.type === 'RingGeometry') {
          const m = p.material as THREE.MeshBasicMaterial;
          m.opacity = 0.28 + Math.sin(this.animTime * 5) * 0.12 + (this.charging ? 0.25 : 0);
        }
      }
    }

    let action: BossAction = null;
    this.patternTimer -= dt;

    const patterns = this.def.patterns;
    const current = patterns[this.patternIdx % patterns.length];

    if (this.charging) {
      this.chargeTimer -= dt;
      const chargeSpeed = this.speed * 4.2;
      this.group.position.x += this.chargeDir.x * chargeSpeed * dt;
      this.group.position.z += this.chargeDir.z * chargeSpeed * dt;
      if (this.chargeTimer <= 0) {
        this.charging = false;
        this.restTimer = 1.0;
        this.nextPattern();
      }
    } else if (this.restTimer > 0) {
      this.restTimer -= dt;
      this.group.position.x += nx * this.speed * 0.35 * dt;
      this.group.position.z += nz * this.speed * 0.35 * dt;
    } else if (this.patternTimer <= 0) {
      action = this.triggerPattern(current, nx, nz);
      if (current !== 'charge') {
        this.restTimer = 0.7;
        this.nextPattern();
      }
    } else {
      this.group.position.x += nx * this.speed * dt;
      this.group.position.z += nz * this.speed * dt;
    }

    const lim = 38;
    this.group.position.x = THREE.MathUtils.clamp(this.group.position.x, -lim, lim);
    this.group.position.z = THREE.MathUtils.clamp(this.group.position.z, -lim, lim);

    let ei = 0.45 + (this.phase > 0 ? 0.2 : 0);
    if (this.hitFlash > 0) {
      this.hitFlash -= dt;
      ei = 1.55;
    } else if (this.charging || this.attackFlash > 0) {
      ei = 0.95 + Math.sin(this.animTime * 18) * 0.35;
      this.accentMat.emissiveIntensity = 1.1;
    } else {
      this.accentMat.emissiveIntensity = 0.65;
    }
    this.mat.emissiveIntensity = ei;

    if (this.phase === 0 && this.hp / this.maxHp < 0.4) {
      this.phase = 1;
      this.speed *= 1.15;
    }

    this.updateGhosts(dt);
    this.updateHpBar();
    if (this.hpBarBg) {
      this.hpBarBg.rotation.set(-0.55, 0, 0);
      this.hpBarFill!.rotation.copy(this.hpBarBg.rotation);
    }

    return action;
  }

  private nextPattern(): void {
    this.patternIdx += 1;
    const interval = this.phase > 0 ? 2.2 : 3.0;
    this.patternTimer = interval;
  }

  private triggerPattern(pattern: BossPattern, nx: number, nz: number): BossAction {
    this.attackFlash = 0.55;
    this.phaseGhostArmed = false;
    if (pattern === 'charge') {
      this.charging = true;
      this.chargeTimer = 0.85 + (this.phase > 0 ? 0.25 : 0);
      this.chargeDir.set(nx, 0, nz);
      this.patternTimer = 99;
      this.ghostCooldown = 0;
      return null;
    }
    if (pattern === 'ring') {
      this.patternTimer = 99;
      return {
        type: 'ring',
        count: this.phase > 0 ? 16 : 12,
        speed: 7.5 + this.phase * 1.5,
        damage: this.contactDamage * 0.55,
        color: this.def!.accent,
      };
    }
    this.patternTimer = 99;
    return { type: 'summon', count: this.phase > 0 ? 6 : 4 };
  }

  takeDamage(amount: number): boolean {
    if (!this.active) return false;
    this.hp -= amount;
    this.hitFlash = 0.1;
    this.updateHpBar();
    if (this.hp <= 0) {
      this.despawn();
      return true;
    }
    return false;
  }

  despawn(): void {
    this.active = false;
    this.group.visible = false;
    this.def = null;
    this.charging = false;
    this.clearGhosts();
  }

  dispose(): void {
    this.clearAccents();
    this.clearGhosts();
    this.body.geometry.dispose();
    this.mat.dispose();
    this.accentMat.dispose();
    if (this.hpBarBg) {
      this.hpBarBg.geometry.dispose();
      (this.hpBarBg.material as THREE.Material).dispose();
    }
    if (this.hpBarFill) {
      this.hpBarFill.geometry.dispose();
      (this.hpBarFill.material as THREE.Material).dispose();
    }
  }
}
