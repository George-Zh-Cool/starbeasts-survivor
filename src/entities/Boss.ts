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
const CHARGE_PIPS = 6;

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
  private windupLeft = 0;
  private windupDur = 0;
  private windupKind: BossPattern | null = null;
  private windupNx = 0;
  private windupNz = 0;
  private chargePips: THREE.Mesh[] = [];
  private punch = 1;
  private ringColor = 0xff4d6d;

  get isCharging(): boolean {
    return this.charging;
  }

  get isWinding(): boolean {
    return this.windupLeft > 0;
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
    this.windupLeft = 0;
    this.windupDur = 0;
    this.windupKind = null;
    this.punch = 1;
    this.group.scale.setScalar(1);
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
    this.ringColor = color;
    if (!this.warnRing) {
      this.warnRing = makeGroundRing(def.radius * 1.28, color, 0.5);
      this.group.add(this.warnRing);
    } else {
      this.warnRing.scale.setScalar(def.radius * 1.28);
      (this.warnRing.material as THREE.MeshBasicMaterial).color.setHex(color);
    }
    this.ensureChargePips();
    this.hideChargePips();
  }

  private ensureChargePips(): void {
    while (this.chargePips.length < CHARGE_PIPS) {
      const pip = makeGroundRing(0.7, 0xffd166, 0.9);
      pip.visible = false;
      this.fxRoot.add(pip);
      this.chargePips.push(pip);
    }
  }

  private hideChargePips(): void {
    for (const pip of this.chargePips) pip.visible = false;
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

    const faceX = this.windupLeft > 0 ? this.windupNx : this.charging ? this.chargeDir.x : nx;
    if (Math.abs(faceX) > 0.05) this.actor.setFacing(faceX > 0);
    this.actor.place(this.animTime, this.charging || this.windupLeft > 0 || this.restTimer <= 0);
    if (this.warnRing && this.windupLeft <= 0) {
      const m = this.warnRing.material as THREE.MeshBasicMaterial;
      m.color.setHex(this.charging ? 0xfff1a8 : this.ringColor);
      m.opacity = 0.32 + Math.sin(this.animTime * 5) * 0.12 + (this.charging ? 0.35 : 0);
      this.warnRing.scale.setScalar(this.radius * (this.charging ? 1.45 : 1.28));
    }
    this.punch += (1 - this.punch) * (1 - Math.exp(-16 * dt));
    this.group.scale.setScalar(this.punch);

    let action: BossAction = null;
    this.patternTimer -= dt;

    const patterns = this.def.patterns;
    const current = patterns[this.patternIdx % patterns.length];

    if (this.windupLeft > 0) {
      this.windupLeft -= dt;
      const creep = this.windupKind === 'charge' ? 0.1 : 0.28;
      this.group.position.x += this.windupNx * this.speed * creep * dt;
      this.group.position.z += this.windupNz * this.speed * creep * dt;
      this.syncTelegraph();
      if (this.windupLeft <= 0) {
        const kind = this.windupKind;
        action = this.releaseWindup();
        if (kind !== 'charge') {
          this.restTimer = 0.7;
          this.nextPattern();
        }
      }
    } else if (this.charging) {
      this.chargeTimer -= dt;
      const chargeSpeed = this.speed * 3.85;
      this.group.position.x += this.chargeDir.x * chargeSpeed * dt;
      this.group.position.z += this.chargeDir.z * chargeSpeed * dt;
      if (this.chargeTimer <= 0) {
        this.charging = false;
        this.restTimer = 1.05;
        this.nextPattern();
      }
    } else if (this.restTimer > 0) {
      this.restTimer -= dt;
      this.group.position.x += nx * this.speed * 0.35 * dt;
      this.group.position.z += nz * this.speed * 0.35 * dt;
    } else if (this.patternTimer <= 0) {
      this.beginWindup(current, nx, nz);
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

  private chargeDuration(): number {
    return 0.85 + (this.phase > 0 ? 0.25 : 0);
  }

  private beginWindup(pattern: BossPattern, nx: number, nz: number): void {
    this.windupKind = pattern;
    this.windupNx = nx;
    this.windupNz = nz;
    this.windupDur = pattern === 'charge' ? (this.phase > 0 ? 0.5 : 0.64) : pattern === 'ring' ? 0.52 : 0.36;
    this.windupLeft = this.windupDur;
    this.attackFlash = this.windupDur + 0.15;
    this.phaseGhostArmed = false;
    this.patternTimer = 99;
    this.syncTelegraph();
  }

  private releaseWindup(): BossAction {
    const pattern = this.windupKind;
    this.windupKind = null;
    this.windupLeft = 0;
    this.hideChargePips();
    if (!pattern || !this.def) return null;
    if (pattern === 'charge') {
      this.charging = true;
      this.chargeTimer = this.chargeDuration();
      this.chargeDir.set(this.windupNx, 0, this.windupNz);
      this.ghostCooldown = 0;
      return null;
    }
    if (pattern === 'ring') {
      return {
        type: 'ring',
        count: this.phase > 0 ? 16 : 12,
        speed: 7.2 + this.phase * 1.2,
        damage: this.contactDamage * 0.55,
        color: this.def.accent,
      };
    }
    return { type: 'summon', count: this.phase > 0 ? 6 : 4 };
  }

  /** 冲撞：一串金环标出锁定方向。环攻：警示圈由小变大。 */
  private syncTelegraph(): void {
    if (!this.warnRing || !this.def) return;
    const mat = this.warnRing.material as THREE.MeshBasicMaterial;
    const left = Math.max(0, this.windupLeft);
    const dur = Math.max(0.05, this.windupDur);
    const progress = 1 - left / dur;
    const blink = 0.35 + 0.65 * Math.abs(Math.sin(this.animTime * 24));
    if (this.windupKind === 'charge') {
      mat.color.setHex(0xffe08a);
      mat.opacity = blink;
      this.warnRing.scale.setScalar(this.radius * (1.15 + 0.2 * Math.sin(this.animTime * 22)));
      const dist = this.speed * 3.85 * this.chargeDuration();
      for (let i = 0; i < this.chargePips.length; i++) {
        const pip = this.chargePips[i];
        const t = (i + 1) / (this.chargePips.length + 0.35);
        pip.visible = true;
        pip.position.set(
          this.group.position.x + this.windupNx * dist * t,
          0.07,
          this.group.position.z + this.windupNz * dist * t,
        );
        pip.scale.setScalar(this.radius * (0.72 + 0.1 * Math.sin(this.animTime * 18 - i)));
        const pm = pip.material as THREE.MeshBasicMaterial;
        pm.color.setHex(i === this.chargePips.length - 1 ? 0xfff6c8 : 0xffd166);
        pm.opacity = 0.72 + 0.28 * Math.abs(Math.sin(this.animTime * 16 - i * 0.55));
      }
      return;
    }
    this.hideChargePips();
    if (this.windupKind === 'ring') {
      mat.color.setHex(0xd8fbff);
      mat.opacity = 0.4 + 0.5 * blink;
      this.warnRing.scale.setScalar(this.radius * (0.45 + progress * 1.25));
      return;
    }
    mat.color.setHex(0xff7ad9);
    mat.opacity = blink;
    this.warnRing.scale.setScalar(this.radius * (1.1 + progress * 0.35));
  }

  takeDamage(amount: number): boolean {
    if (!this.active) return false;
    this.hp -= amount;
    this.hitFlash = 0.14;
    this.punch = 1.16;
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
    this.windupLeft = 0;
    this.windupKind = null;
    this.punch = 1;
    this.group.scale.setScalar(1);
    this.hideChargePips();
    this.clearGhosts();
  }

  dispose(): void {
    this.clearGhosts();
    for (const pip of this.chargePips) {
      this.fxRoot.remove(pip);
      pip.geometry.dispose();
      (pip.material as THREE.Material).dispose();
    }
    this.chargePips = [];
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
