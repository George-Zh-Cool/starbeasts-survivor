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

  constructor() {
    this.id = nextEnemyId++;
    this.mesh = new THREE.Group();
    this.actor = new PixelActor('crystal', 0.55, 3);
    this.shadow = makeShadow(0.8);
    this.eliteRing = makeGroundRing(1, 0xff3d8a, 0.65);
    this.eliteRing.visible = false;
    this.mesh.add(this.shadow);
    this.mesh.add(this.eliteRing);
    this.mesh.add(this.actor.sprite);
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
    this.knockVx = 0;
    this.knockVz = 0;
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
    if (!this.active) return;
    if (this.kind === 'elite') force *= 0.25;
    if (this.affix?.id === 'hardened') force *= 0.5;
    const len = Math.hypot(dirX, dirZ) || 1;
    this.knockVx += (dirX / len) * force;
    this.knockVz += (dirZ / len) * force;
  }

  update(dt: number, targetX: number, targetZ: number): void {
    if (!this.active) return;
    this.animTime += dt;
    this.mesh.position.x += this.knockVx * dt;
    this.mesh.position.z += this.knockVz * dt;
    this.knockVx *= Math.max(0, 1 - dt * 8);
    this.knockVz *= Math.max(0, 1 - dt * 8);

    const dx = targetX - this.mesh.position.x;
    const dz = targetZ - this.mesh.position.z;
    const len = Math.hypot(dx, dz) || 1;
    this.mesh.position.x += (dx / len) * this.speed * dt;
    this.mesh.position.z += (dz / len) * this.speed * dt;
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
  }

  takeDamage(amount: number): boolean {
    if (!this.active) return false;
    const mul = this.affix?.damageTakenMul ?? 1;
    this.hp -= amount * mul;
    this.hitFlash = 0.08;
    if (this.hp <= 0) {
      this.despawn();
      return true;
    }
    return false;
  }

  despawn(): void {
    this.active = false;
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
