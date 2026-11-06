import * as THREE from 'three';
import type { EnemyDef, EnemyKind } from '../data/enemies';
import type { AffixDef } from '../data/affixes';
import { PixelActor, badgeTexture, type CreatureId } from '../visual/sprites';
import { makeGroundRing, makeShadow } from '../visual/pixelScene';

let nextEnemyId = 1;

export class Enemy {
  readonly id: number;
  readonly mesh: THREE.Group;
  active = false;
  kind: EnemyKind = 'darkcrystal';
  hp = 0;
  maxHp = 0;
  speed = 0;
  baseSpeed = 0;
  contactDamage = 0;
  xp = 1;
  radius = 0.5;
  hitFlash = 0;
  /** 死亡爆开期间仍占着格子，但不再受伤、不再造成接触伤害。 */
  dying = false;
  affix: AffixDef | null = null;
  isSplitling = false;
  private knockVx = 0;
  private knockVz = 0;
  private outline: THREE.Mesh | null = null;
  private badge: THREE.Sprite | null = null;
  private readonly actor: PixelActor;
  private readonly shadow: THREE.Mesh;
  private readonly eliteRing: THREE.Mesh;
  private animTime = 0;
  private deathLeft = 0;
  private punch = 1;
  private punchCd = 0;
  private flinch = 0;
  private slowTimer = 0;
  private slowFactor = 1;
  private dashCd = 1.5;
  private windup = 0;
  private dashLeft = 0;
  private dashX = 0;
  private dashZ = 0;
  private hpShow = 0;
  private readonly hpBg: THREE.Mesh;
  private readonly hpFill: THREE.Mesh;

  constructor() {
    this.id = nextEnemyId++;
    this.mesh = new THREE.Group();
    this.actor = new PixelActor('crystal', 0.55, 3);
    this.shadow = makeShadow(0.8);
    this.eliteRing = makeGroundRing(1, 0xff3d8a, 0.65);
    this.eliteRing.visible = false;
    this.hpBg = new THREE.Mesh(
      new THREE.PlaneGeometry(1.15, 0.12),
      new THREE.MeshBasicMaterial({ color: 0x14080e, transparent: true, opacity: 0.92, depthWrite: false }),
    );
    this.hpFill = new THREE.Mesh(
      new THREE.PlaneGeometry(1.05, 0.07),
      new THREE.MeshBasicMaterial({ color: 0xfff3c4, depthWrite: false }),
    );
    this.hpBg.visible = false;
    this.hpFill.visible = false;
    this.hpBg.renderOrder = 6;
    this.hpFill.renderOrder = 6;
    this.mesh.add(this.shadow);
    this.mesh.add(this.eliteRing);
    this.mesh.add(this.actor.sprite);
    this.mesh.add(this.hpBg);
    this.mesh.add(this.hpFill);
    this.mesh.visible = false;
  }

  spawn(
    def: EnemyDef,
    x: number,
    z: number,
    hpMul: number,
    speedMul: number,
    dmgMul: number,
    affix: AffixDef | null = null,
    opts?: { isSplitling?: boolean; hpScale?: number; sizeScale?: number },
  ): void {
    this.clearAffixVisuals();
    this.active = true;
    this.kind = def.kind;
    this.isSplitling = !!opts?.isSplitling;
    this.affix = this.isSplitling ? null : affix;
    const sizeScale = opts?.sizeScale ?? 1;
    const hpScale = opts?.hpScale ?? 1;
    this.radius = def.radius * sizeScale;
    this.maxHp = def.baseHp * hpMul * hpScale * (this.affix?.id === 'hardened' ? 1.15 : 1);
    this.hp = this.maxHp;
    this.baseSpeed = def.baseSpeed * speedMul * (this.affix?.speedMul ?? 1);
    this.speed = this.baseSpeed;
    this.contactDamage = def.contactDamage * dmgMul;
    this.xp = Math.max(1, Math.floor(def.xp * (this.affix ? 1.5 : 1) * (this.isSplitling ? 0.5 : 1)));
    this.hitFlash = 0;
    this.dying = false;
    this.deathLeft = 0;
    this.punch = 1;
    this.punchCd = 0;
    this.mesh.scale.setScalar(1);
    this.actor.setOpacity(1);
    this.actor.flash(0);
    this.knockVx = 0;
    this.knockVz = 0;
    this.flinch = 0;
    this.slowTimer = 0;
    this.slowFactor = 1;
    this.windup = 0;
    this.dashLeft = 0;
    this.dashCd = 0.9 + Math.random() * 1.4;
    this.hpShow = 0;
    this.hpBg.visible = false;
    this.hpFill.visible = false;
    this.animTime = Math.random() * 10;
    this.mesh.visible = true;
    this.mesh.position.set(x, 0, z);

    const shape: CreatureId = def.shape;
    this.actor.retarget(shape, this.radius);
    const fw = Math.max(0.55, this.actor.width * 0.78);
    this.shadow.scale.set(fw, fw * 0.55, 1);
    this.eliteRing.visible = def.kind === 'elite';
    if (def.kind === 'elite') this.eliteRing.scale.setScalar(this.radius * 1.35);
    if (this.affix) this.buildAffixVisuals(this.affix);
  }

  private buildAffixVisuals(affix: AffixDef): void {
    this.outline = makeGroundRing(this.radius * 1.45, affix.color, 0.75);
    this.mesh.add(this.outline);

    const mat = new THREE.SpriteMaterial({
      map: badgeTexture(),
      color: affix.color,
      transparent: true,
      alphaTest: 0.15,
      depthWrite: false,
      toneMapped: false,
    });
    this.badge = new THREE.Sprite(mat);
    this.badge.center.set(0.5, 0.5);
    this.badge.scale.set(0.46, 0.46, 1);
    this.badge.position.y = this.actor.height + 0.28;
    this.badge.renderOrder = 5;
    this.mesh.add(this.badge);
  }

  private clearAffixVisuals(): void {
    if (this.outline) {
      this.mesh.remove(this.outline);
      this.outline.geometry.dispose();
      (this.outline.material as THREE.Material).dispose();
      this.outline = null;
    }
    if (this.badge) {
      this.mesh.remove(this.badge);
      (this.badge.material as THREE.Material).dispose();
      this.badge = null;
    }
  }

  applyKnockback(dirX: number, dirZ: number, force: number): void {
    if (!this.active || this.dying) return;
    if (this.kind === 'elite') force *= 0.42;
    if (this.kind === 'rockcrab') force *= 0.45;
    if (this.kind === 'embermoth') force *= 1.35;
    if (this.affix?.id === 'hardened') force *= 0.5;
    const len = Math.hypot(dirX, dirZ) || 1;
    this.knockVx += (dirX / len) * force;
    this.knockVz += (dirZ / len) * force;
  }

  applySlow(duration: number, factor: number): void {
    if (!this.active || this.dying) return;
    let f = factor;
    if (this.kind === 'elite' || this.kind === 'rockcrab') f = 1 - (1 - f) * 0.45;
    if (this.affix?.id === 'hardened') f = 1 - (1 - f) * 0.4;
    this.slowTimer = Math.max(this.slowTimer, duration);
    this.slowFactor = Math.min(this.slowFactor, Math.max(0.35, f));
  }

  update(dt: number, targetX: number, targetZ: number): void {
    if (!this.active) return;
    this.animTime += dt;
    if (this.dying) {
      this.hpBg.visible = false;
      this.hpFill.visible = false;
      this.deathLeft -= dt;
      const t = 1 - Math.max(0, this.deathLeft) / 0.2;
      this.mesh.scale.setScalar(1 + t * 0.85);
      this.actor.sprite.position.y = t * 0.42;
      this.actor.flash(1);
      this.actor.setOpacity(1 - t * t);
      if (this.deathLeft <= 0) this.despawn();
      return;
    }
    if (this.punchCd > 0) this.punchCd -= dt;
    this.punch += (1 - this.punch) * (1 - Math.exp(-18 * dt));
    const squash = this.flinch > 0 ? 0.82 : 1;
    this.mesh.scale.set(this.punch * (2 - squash), this.punch * squash, 1);
    this.mesh.position.x += this.knockVx * dt;
    this.mesh.position.z += this.knockVz * dt;
    this.knockVx *= Math.max(0, 1 - dt * 7);
    this.knockVz *= Math.max(0, 1 - dt * 7);
    if (this.flinch > 0) this.flinch -= dt;
    if (this.hpShow > 0) this.hpShow -= dt;
    if (this.slowTimer > 0) {
      this.slowTimer -= dt;
      if (this.slowTimer <= 0) {
        this.slowTimer = 0;
        this.slowFactor = 1;
      }
    }

    const dx = targetX - this.mesh.position.x;
    const dz = targetZ - this.mesh.position.z;
    const len = Math.hypot(dx, dz) || 1;
    let move = this.flinch > 0 ? 0 : this.speed * (this.slowTimer > 0 ? this.slowFactor : 1);
    if (this.kind === 'elite' && !this.isSplitling && this.flinch <= 0) {
      if (this.dashLeft > 0) {
        this.mesh.position.x += this.dashX * 10 * dt;
        this.mesh.position.z += this.dashZ * 10 * dt;
        this.dashLeft -= dt;
        move = 0;
        this.hitFlash = Math.max(this.hitFlash, 0.08);
      } else if (this.windup > 0) {
        this.windup -= dt;
        move = 0;
        this.hitFlash = Math.max(this.hitFlash, 0.08);
        if (this.windup <= 0) {
          this.dashLeft = 0.24;
          this.dashX = dx / len;
          this.dashZ = dz / len;
        }
      } else {
        this.dashCd -= dt;
        if (this.dashCd <= 0) {
          this.dashCd = 2.8 + Math.random() * 0.8;
          this.windup = 0.36;
        }
      }
    }
    if (move > 0) {
      this.mesh.position.x += (dx / len) * move * dt;
      this.mesh.position.z += (dz / len) * move * dt;
      if (this.kind === 'embermoth') {
        const strafe = Math.sin(this.animTime * 7 + this.id) * this.baseSpeed * 0.55;
        this.mesh.position.x += (-dz / len) * strafe * dt;
        this.mesh.position.z += (dx / len) * strafe * dt;
      }
    }
    if (Math.abs(dx) > 0.05) this.actor.setFacing(dx > 0);
    this.actor.place(this.animTime, this.speed > 0.2);
    if (this.hitFlash > 0) this.hitFlash -= dt;
    this.actor.flash(this.hitFlash > 0 ? 1 : 0);

    if (this.eliteRing.visible) {
      const mat = this.eliteRing.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.45 + Math.sin(this.animTime * 4 + this.id) * 0.15;
    }
    if (this.badge) {
      const mat = this.badge.material as THREE.SpriteMaterial;
      mat.rotation += dt * 2.4;
      this.badge.position.y = this.actor.height + 0.28 + Math.sin(this.animTime * 5) * 0.08;
    }
    if (this.outline) {
      const om = this.outline.material as THREE.MeshBasicMaterial;
      om.opacity = 0.55 + Math.sin(this.animTime * 5 + this.id) * 0.18;
    }

    if (this.affix && this.affix.regenPerSec > 0 && this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + this.maxHp * this.affix.regenPerSec * dt);
    }
    this.refreshHpBar();
  }

  private refreshHpBar(): void {
    if (this.hpShow <= 0 || this.dying || !this.active) {
      this.hpBg.visible = false;
      this.hpFill.visible = false;
      return;
    }
    const ratio = this.maxHp > 0 ? Math.max(0, this.hp / this.maxHp) : 0;
    const y = this.actor.height + 0.22;
    this.hpBg.visible = true;
    this.hpFill.visible = true;
    this.hpBg.position.set(0, y, 0);
    this.hpFill.position.set(-0.525 * (1 - ratio), y, 0.02);
    this.hpFill.scale.x = Math.max(0.04, ratio);
    this.hpBg.rotation.x = -0.85;
    this.hpFill.rotation.x = -0.85;
    const mat = this.hpFill.material as THREE.MeshBasicMaterial;
    mat.color.setHex(ratio < 0.35 ? 0xff5a6a : 0xfff3c4);
  }

  takeDamage(amount: number, hit?: { flinch?: boolean; heavy?: boolean }): boolean {
    if (!this.active || this.dying) return false;
    const mul = this.affix?.damageTakenMul ?? 1;
    this.hp -= amount * mul;
    this.hitFlash = hit?.heavy ? 0.16 : 0.12;
    this.hpShow = 1.25;
    if (hit?.flinch) {
      let pause = hit.heavy ? 0.2 : 0.16;
      if (this.kind === 'elite') pause *= 0.55;
      if (this.affix?.id === 'hardened') pause *= 0.65;
      this.flinch = Math.max(this.flinch, pause);
    }
    if (this.punchCd <= 0 || hit?.heavy) {
      this.punch = hit?.heavy ? 1.38 : 1.26;
      this.punchCd = 0.08;
    }
    this.refreshHpBar();
    if (this.hp <= 0) {
      this.dying = true;
      this.deathLeft = 0.2;
      this.knockVx = 0;
      this.knockVz = 0;
      this.flinch = 0;
      return true;
    }
    return false;
  }

  despawn(): void {
    this.active = false;
    this.dying = false;
    this.deathLeft = 0;
    this.punch = 1;
    this.mesh.scale.setScalar(1);
    this.actor.setOpacity(1);
    this.actor.flash(0);
    this.mesh.visible = false;
    this.clearAffixVisuals();
  }

  dispose(): void {
    this.clearAffixVisuals();
    this.actor.dispose();
    this.mesh.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        const m = obj.material;
        if (Array.isArray(m)) m.forEach((x) => x.dispose());
        else m.dispose();
      }
    });
  }
}
