import * as THREE from 'three';
import type { EnemyDef, EnemyKind } from '../data/enemies';
import type { AffixDef } from '../data/affixes';
import { buildEnemyVisual, stdMat, type EnemyAnim } from '../visual/builders';
import { getEnemyTexture } from '../visual/textures';

let nextEnemyId = 1;

export class Enemy {
  readonly id: number;
  readonly mesh: THREE.Group;
  /** 兼容引用：指向部件根下第一件 Mesh */
  body: THREE.Mesh;
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
  private mat: THREE.MeshStandardMaterial;
  private outline: THREE.Mesh | null = null;
  private badge: THREE.Mesh | null = null;
  private baseEmissive = 0.22;
  private readonly partsRoot: THREE.Group;
  private anim: EnemyAnim = {};
  private animTime = 0;
  private extraMats: THREE.Material[] = [];

  constructor() {
    this.id = nextEnemyId++;
    this.mesh = new THREE.Group();
    this.partsRoot = new THREE.Group();
    this.mesh.add(this.partsRoot);
    this.mat = stdMat(0x888888, { ei: 0.2, rough: 0.55, metal: 0.15 });
    this.body = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), this.mat);
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
    this.clearParts();
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

    this.mat.color.setHex(def.color);
    this.mat.emissive.setHex(def.color);
    this.baseEmissive = def.kind === 'elite' ? 0.55 : 0.28;
    if (this.affix) this.baseEmissive = Math.max(this.baseEmissive, 0.42);
    this.mat.emissiveIntensity = this.baseEmissive;

    const shape = def.shape === 'elite' ? 'elite' : def.shape;
    const detailMap = getEnemyTexture(shape, def.color);
    this.mat.map = detailMap;
    this.mat.needsUpdate = true;
    const built = buildEnemyVisual(shape, this.radius, def.color, this.mat, def.kind === 'elite', detailMap);
    this.partsRoot.add(built.rig);
    this.anim = built.anim;

    // 收集额外材质以便销毁
    built.rig.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        const m = o.material;
        if (m !== this.mat) {
          if (Array.isArray(m)) this.extraMats.push(...m);
          else this.extraMats.push(m);
        }
        if (!this.body.parent || this.body.geometry.type === 'BoxGeometry') {
          // 首次或占位 body：改挂到可视 mesh 引用
        }
      }
    });
    let first: THREE.Mesh | null = null;
    built.rig.traverse((o) => {
      if (!first && o instanceof THREE.Mesh) first = o;
    });
    if (first) this.body = first;

    // 精英更大更醒目：整体略抬高光环已在 builder
    if (def.kind === 'elite') {
      this.partsRoot.scale.setScalar(1.08);
    } else {
      this.partsRoot.scale.setScalar(1);
    }

    if (this.affix) this.buildAffixVisuals(this.affix);
  }

  private clearParts(): void {
    while (this.partsRoot.children.length > 0) {
      const c = this.partsRoot.children[0];
      this.partsRoot.remove(c);
      c.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
        }
      });
    }
    for (const m of this.extraMats) m.dispose();
    this.extraMats = [];
    this.anim = {};
  }

  private buildAffixVisuals(affix: AffixDef): void {
    const ringMat = new THREE.MeshBasicMaterial({
      color: affix.color,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.outline = new THREE.Mesh(
      new THREE.RingGeometry(this.radius * 0.85, this.radius * 1.55, 32),
      ringMat,
    );
    this.outline.rotation.x = -Math.PI / 2;
    this.outline.position.y = 0.07;
    this.mesh.add(this.outline);

    // 外圈细描边
    const outerMat = new THREE.MeshBasicMaterial({
      color: affix.color,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const outer = new THREE.Mesh(
      new THREE.RingGeometry(this.radius * 1.55, this.radius * 1.75, 32),
      outerMat,
    );
    outer.rotation.x = -Math.PI / 2;
    outer.position.y = 0.07;
    this.outline.add(outer);

    const badgeMat = new THREE.MeshStandardMaterial({
      color: affix.color,
      emissive: affix.color,
      emissiveIntensity: 1.0,
      roughness: 0.25,
      metalness: 0.25,
    });
    this.badge = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), badgeMat);
    this.badge.position.y = this.radius * 2.35 + 0.4;
    this.mesh.add(this.badge);
  }

  private clearAffixVisuals(): void {
    if (this.outline) {
      this.outline.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          const m = obj.material;
          if (Array.isArray(m)) m.forEach((x) => x.dispose());
          else m.dispose();
        }
      });
      this.mesh.remove(this.outline);
      this.outline = null;
    }
    if (this.badge) {
      this.mesh.remove(this.badge);
      this.badge.geometry.dispose();
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
    this.partsRoot.rotation.y = Math.atan2(dx, dz);

    if (this.anim.spin) {
      for (const s of this.anim.spin) {
        s.rotation.y += dt * (this.kind === 'darkcrystal' ? 1.8 : 2.4);
      }
    }
    if (this.anim.bob) {
      for (let i = 0; i < this.anim.bob.length; i++) {
        const b = this.anim.bob[i];
        if (b instanceof THREE.Mesh && b.geometry.type === 'RingGeometry') {
          const m = b.material as THREE.MeshBasicMaterial;
          m.opacity = 0.35 + Math.sin(this.animTime * 4 + this.id) * 0.12;
        } else {
          b.rotation.y = Math.sin(this.animTime * 5) * 0.35;
        }
      }
    }

    if (this.badge) {
      this.badge.rotation.y += dt * 3.5;
      this.badge.position.y = this.radius * 2.35 + 0.4 + Math.sin(this.animTime * 5) * 0.1;
    }
    if (this.outline) {
      const om = this.outline.material as THREE.MeshBasicMaterial;
      om.opacity = 0.55 + Math.sin(this.animTime * 5 + this.id) * 0.18;
      this.outline.rotation.z += dt * 0.6;
    }

    if (this.affix && this.affix.regenPerSec > 0 && this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + this.maxHp * this.affix.regenPerSec * dt);
    }

    const ei = this.hitFlash > 0 ? 1.45 : this.baseEmissive;
    if (this.hitFlash > 0) this.hitFlash -= dt;
    this.mat.emissiveIntensity = ei;
    this.partsRoot.traverse((o) => {
      if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial && o.material !== this.mat) {
        o.material.emissiveIntensity = this.hitFlash > 0 ? 1.2 : (o.material.userData.baseEi ?? 0.45);
      }
    });
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
    this.clearParts();
    this.mat.dispose();
  }
}
