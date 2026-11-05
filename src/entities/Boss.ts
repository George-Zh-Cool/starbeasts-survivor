import * as THREE from 'three';
import type { BossDef, BossPattern } from '../data/bosses';
import { PixelActor, type CreatureId } from '../visual/sprites';
import { makeGroundRing, makeShadow } from '../visual/pixelScene';

export type BossAction =
  | { type: 'ring'; count: number; speed: number; damage: number; color: number }
  | { type: 'summon'; count: number }
  | null;

type Ghost = {
  sprite: THREE.Sprite;
  life: number;
  maxLife: number;
};

const MAX_GHOSTS = 10;

export class Boss {
  readonly group: THREE.Group;
  /** 残影挂在场景根，不跟随 Boss 位移 */
  readonly fxRoot: THREE.Group;
  private actor: PixelActor | null = null;
  private shadow: THREE.Mesh | null = null;
  private warnRing: THREE.Mesh | null = null;
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
    this.group.visible = false;
  }

  spawn(def: BossDef, x: number, z: number, hpMul: number, speedMul: number, dmgMul: number): void {
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
    this.ensureVisual(def);
    this.ensureHpBar();
    this.updateHpBar();
  }

  private ensureVisual(def: BossDef): void {
    const id: CreatureId = def.shape === 'horn' ? 'horn' : 'core';
    if (!this.actor) {
      this.actor = new PixelActor(id, def.radius, 4);
      this.group.add(this.actor.sprite);
    } else {
      this.actor.retarget(id, def.radius);
    }
    const fw = Math.max(this.actor.width, def.radius) * 0.9;
    if (!this.shadow) {
      this.shadow = makeShadow(fw);
      this.group.add(this.shadow);
    }
    this.shadow.scale.set(fw, fw * 0.5, 1);

    const color = def.shape === 'horn' ? 0xff4d6d : 0x7b2cbf;
    if (!this.warnRing) {
      this.warnRing = makeGroundRing(def.radius * 1.28, color, 0.5);
      this.group.add(this.warnRing);
    } else {
      this.warnRing.scale.setScalar(def.radius * 1.28);
      (this.warnRing.material as THREE.MeshBasicMaterial).color.setHex(color);
    }
  }

  private clearGhosts(): void {
    for (const g of this.ghosts) {
      this.fxRoot.remove(g.sprite);
      g.sprite.material.dispose();
    }
    this.ghosts.length = 0;
  }

  private spawnGhost(opts?: { opacity?: number; scale?: number; life?: number; offsetX?: number; offsetZ?: number }): void {
    if (!this.actor) return;
    while (this.ghosts.length >= MAX_GHOSTS) {
      const old = this.ghosts.shift()!;
      this.fxRoot.remove(old.sprite);
      old.sprite.material.dispose();
    }
    const baseOp = opts?.opacity ?? 0.35;
    const mat = this.actor.material.clone();
    mat.opacity = baseOp;
    mat.depthWrite = false;
    mat.alphaTest = 0.05;
    mat.transparent = true;
    const sprite = new THREE.Sprite(mat);
    sprite.center.copy(this.actor.sprite.center);
    const sc = opts?.scale ?? 1;
    sprite.scale.set(Math.abs(this.actor.sprite.scale.x) * sc, this.actor.sprite.scale.y * sc, 1);
    sprite.renderOrder = 2;
    const wp = new THREE.Vector3();
    this.actor.sprite.getWorldPosition(wp);
    sprite.position.set(wp.x + (opts?.offsetX ?? 0), wp.y, wp.z + (opts?.offsetZ ?? 0));
    this.fxRoot.add(sprite);
    const maxLife = opts?.life ?? 0.28;
    this.ghosts.push({ sprite, life: maxLife, maxLife });
  }

  private updateGhosts(dt: number): void {
    this.ghostCooldown = Math.max(0, this.ghostCooldown - dt);

    if (this.charging && this.def?.shape === 'horn') {
      if (this.ghostCooldown <= 0) {
        this.spawnGhost({ opacity: 0.4, life: 0.32 });
        this.ghostCooldown = 0.055;
      }
    }

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
      const m = g.sprite.material;
      m.opacity = t * 0.4;
      g.sprite.scale.multiplyScalar(1 + dt * 0.35);
      if (g.life <= 0) {
        this.fxRoot.remove(g.sprite);
        m.dispose();
        this.ghosts.splice(i, 1);
      }
    }
  }

  private ensureHpBar(): void {
    if (this.hpBarBg) return;
    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 0.22),
      new THREE.MeshBasicMaterial({ color: 0x14080c, transparent: true, opacity: 0.85, depthWrite: false }),
    );
    const fill = new THREE.Mesh(
      new THREE.PlaneGeometry(3.0, 0.14),
      new THREE.MeshBasicMaterial({ color: 0xff4d6d, depthWrite: false }),
    );
    bg.renderOrder = 6;
    fill.renderOrder = 6;
    this.group.add(bg);
    this.group.add(fill);
    this.hpBarBg = bg;
    this.hpBarFill = fill;
  }

  private updateHpBar(): void {
    if (!this.hpBarFill || !this.hpBarBg || !this.actor) return;
    const r = this.maxHp > 0 ? Math.max(0, this.hp / this.maxHp) : 0;
    this.hpBarFill.scale.x = Math.max(0.001, r);
    this.hpBarFill.position.x = -1.5 * (1 - r);
    const y = this.actor.height + 0.45;
    this.hpBarBg.position.y = y;
    this.hpBarFill.position.y = y;
    this.hpBarFill.position.z = 0.02;
  }

  update(dt: number, targetX: number, targetZ: number): BossAction {
    if (!this.active || !this.def || !this.actor) return null;
    this.animTime += dt;
    if (this.attackFlash > 0) this.attackFlash -= dt;

    const dx = targetX - this.group.position.x;
    const dz = targetZ - this.group.position.z;
    const dist = Math.hypot(dx, dz) || 1;
    const nx = dx / dist;
    const nz = dz / dist;

    if (Math.abs(nx) > 0.05) this.actor.setFacing(nx > 0);
    this.actor.place(this.animTime, this.charging || this.restTimer <= 0);
    if (this.warnRing) {
      const m = this.warnRing.material as THREE.MeshBasicMaterial;
      m.opacity = 0.32 + Math.sin(this.animTime * 5) * 0.12 + (this.charging ? 0.28 : 0);
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

    let flash = 0;
    if (this.hitFlash > 0) {
      this.hitFlash -= dt;
      flash = 1;
    } else if (this.charging || this.attackFlash > 0) {
      flash = 0.45 + Math.sin(this.animTime * 18) * 0.25;
    }
    this.actor.flash(flash);

    if (this.phase === 0 && this.hp / this.maxHp < 0.4) {
      this.phase = 1;
      this.speed *= 1.15;
    }

    this.updateGhosts(dt);
    this.updateHpBar();
    if (this.hpBarBg && this.hpBarFill) {
      this.hpBarBg.rotation.set(-0.7, 0, 0);
      this.hpBarFill.rotation.copy(this.hpBarBg.rotation);
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
    this.clearGhosts();
    this.actor?.dispose();
    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        const mat = obj.material;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat.dispose();
      }
    });
  }
}
