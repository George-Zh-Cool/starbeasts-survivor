import * as THREE from 'three';
import type { CharacterDef } from '../data/characters';
import {
  createBaseTraitStats,
  type MutableStats,
  type UpgradeId,
} from '../data/upgrades';
import {
  AUTO_EVOLVE_LEVEL,
  getWeaponForm,
  type WeaponForm,
  type WeaponTier,
} from '../data/weapons';
import { BALANCE, xpToNextForLevel } from '../data/balance';
import { buildFalcon, buildFox, buildTurtle, stdMat } from '../visual/builders';
import { getCharAccentTexture, getCharBodyTexture } from '../visual/textures';

export class Player {
  readonly group: THREE.Group;
  /** 主躯干网格（保留兼容：发光闪白挂在 flashMat） */
  readonly body: THREE.Mesh;
  readonly stats: MutableStats;
  readonly weaponKind: CharacterDef['weaponKind'];
  readonly accent: number;
  readonly color: number;
  attackCooldown = 0;
  invuln = 0;
  facing = new THREE.Vector3(0, 0, -1);
  level = 1;
  xp = 0;
  xpToNext = 12;
  kills = 0;
  characterId: string;
  weaponTier: WeaponTier = 0;
  readonly ownedUpgrades = new Set<UpgradeId>();
  readonly activatedSynergies = new Set<string>();
  shieldOnKill = 0;
  slowTimer = 0;
  slowFactor = 1;
  lastDamageTaken = 0;
  private flashMat: THREE.MeshStandardMaterial;
  private baseEmissive: number;
  private pulseTimer = 0;
  private readonly modelRoot: THREE.Group;
  private animTime = 0;
  private readonly animParts: {
    tail?: THREE.Object3D;
    ears?: THREE.Object3D[];
    shell?: THREE.Object3D;
    wings?: THREE.Object3D[];
  } = {};

  constructor(def: CharacterDef) {
    this.characterId = def.id;
    this.weaponKind = def.weaponKind;
    this.color = def.color;
    this.accent = def.accent;
    this.stats = {
      maxHp: def.base.maxHp,
      hp: def.base.maxHp,
      moveSpeed: def.base.moveSpeed,
      damage: def.base.damage,
      attackInterval: def.base.attackInterval,
      projectileSpeed: def.base.projectileSpeed,
      projectileCount: Math.max(1, def.base.projectileCount),
      pierce: def.base.pierce,
      pickupRadius: def.base.pickupRadius,
      lifeSteal: def.base.lifeSteal,
      auraRadius: def.base.auraRadius ?? 0,
      ...createBaseTraitStats(),
    };

    this.group = new THREE.Group();
    this.group.position.set(0, 0, 0);
    this.modelRoot = new THREE.Group();
    this.group.add(this.modelRoot);

    const bodyMap = getCharBodyTexture(def.shape, def.color, def.accent);
    const accentMap = getCharAccentTexture(def.shape, def.color, def.accent);
    const mat = stdMat(def.color, { ei: 0.32, rough: 0.42, metal: 0.22, map: bodyMap });
    this.flashMat = mat;
    this.baseEmissive = 0.32;

    let rig: THREE.Group;
    if (def.shape === 'fox') {
      const built = buildFox(def.color, def.accent, mat, accentMap);
      rig = built.rig;
      this.animParts.tail = built.anim.tail;
      this.animParts.ears = built.anim.ears;
    } else if (def.shape === 'turtle') {
      const built = buildTurtle(def.color, def.accent, mat, accentMap);
      rig = built.rig;
      this.animParts.shell = built.anim.shell;
    } else {
      const built = buildFalcon(def.color, def.accent, mat, accentMap);
      rig = built.rig;
      this.animParts.wings = built.anim.wings;
    }
    this.modelRoot.add(rig);

    // body 指向第一件 Mesh，供旧代码引用；旋转改走 modelRoot
    let firstMesh: THREE.Mesh | null = null;
    rig.traverse((o) => {
      if (!firstMesh && o instanceof THREE.Mesh) firstMesh = o;
    });
    this.body = firstMesh ?? new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), mat);

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.62, 20),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.38 }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;
    this.group.add(shadow);

    // 脚下主题光环
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 0.68, 28),
      new THREE.MeshBasicMaterial({
        color: def.accent,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.04;
    this.group.add(ring);
  }

  get weaponForm(): WeaponForm {
    return getWeaponForm(this.characterId, this.weaponTier);
  }

  get position(): THREE.Vector3 {
    return this.group.position;
  }

  get alive(): boolean {
    return this.stats.hp > 0;
  }

  evolveWeapon(): WeaponForm | null {
    if (this.weaponTier >= 2) return null;
    this.weaponTier = (this.weaponTier + 1) as WeaponTier;
    const form = this.weaponForm;
    this.stats.damage *= form.tier === 1 ? 1.08 : 1.1;
    if (this.weaponKind === 'aura') {
      this.stats.auraRadius += form.tier === 1 ? 0.35 : 0.25;
    }
    this.baseEmissive = 0.32 + this.weaponTier * 0.14;
    this.flashMat.emissiveIntensity = this.baseEmissive;
    return form;
  }

  tryAutoEvolve(): WeaponForm | null {
    if (this.weaponTier < 1 && this.level >= AUTO_EVOLVE_LEVEL[1]) {
      return this.evolveWeapon();
    }
    if (this.weaponTier === 1 && this.level >= AUTO_EVOLVE_LEVEL[2]) {
      return this.evolveWeapon();
    }
    return null;
  }

  rollDamage(): { damage: number; crit: boolean } {
    const form = this.weaponForm;
    let dmg = this.stats.damage * form.damageMul;
    let crit = false;
    if (this.stats.critChance > 0 && Math.random() < this.stats.critChance) {
      dmg *= this.stats.critMul;
      crit = true;
    }
    return { damage: dmg, crit };
  }

  applySlow(duration: number, factor: number): void {
    this.slowTimer = Math.max(this.slowTimer, duration);
    this.slowFactor = Math.min(this.slowFactor, factor);
  }

  updateMovement(dt: number, mx: number, mz: number, lookX?: number, lookZ?: number): void {
    if (!this.alive) return;
    this.animTime += dt;
    if (this.slowTimer > 0) {
      this.slowTimer -= dt;
      if (this.slowTimer <= 0) {
        this.slowTimer = 0;
        this.slowFactor = 1;
      }
    }
    const spd = this.stats.moveSpeed * (this.slowTimer > 0 ? this.slowFactor : 1);
    const len = Math.hypot(mx, mz);
    if (len > 0) {
      const nx = mx / len;
      const nz = mz / len;
      this.group.position.x += nx * spd * dt;
      this.group.position.z += nz * spd * dt;
      this.facing.set(nx, 0, nz);
    }
    if (lookX !== undefined && lookZ !== undefined) {
      const dx = lookX - this.group.position.x;
      const dz = lookZ - this.group.position.z;
      if (dx * dx + dz * dz > 0.01) {
        this.facing.set(dx, 0, dz).normalize();
      }
    }
    const angle = Math.atan2(this.facing.x, this.facing.z);
    this.modelRoot.rotation.y = angle;

    // 呼吸缩放 + 部件动画
    const breath = 1 + Math.sin(this.animTime * 3.2) * 0.025;
    this.modelRoot.scale.setScalar(breath);
    if (this.animParts.tail) {
      this.animParts.tail.rotation.y = Math.sin(this.animTime * 5) * 0.35;
      this.animParts.tail.rotation.x = Math.sin(this.animTime * 3.5) * 0.12;
    }
    if (this.animParts.ears) {
      for (let i = 0; i < this.animParts.ears.length; i++) {
        this.animParts.ears[i].rotation.z = (i === 0 ? -0.35 : 0.35) + Math.sin(this.animTime * 4 + i) * 0.08;
      }
    }
    if (this.animParts.shell) {
      this.animParts.shell.position.y = 0.58 + Math.sin(this.animTime * 2.2) * 0.03;
    }
    if (this.animParts.wings) {
      for (let i = 0; i < this.animParts.wings.length; i++) {
        const sx = i === 0 ? -1 : 1;
        this.animParts.wings[i].rotation.z = sx * (0.15 + Math.sin(this.animTime * 6) * 0.22);
      }
    }

    if (this.invuln > 0) {
      this.invuln -= dt;
      this.flashMat.emissiveIntensity = this.baseEmissive + Math.sin(this.invuln * 40) * 0.6;
    } else {
      this.flashMat.emissiveIntensity = this.baseEmissive;
    }

    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
  }

  tickPulse(dt: number): boolean {
    const form = this.weaponForm;
    if (form.pulseInterval <= 0) return false;
    this.pulseTimer -= dt;
    if (this.pulseTimer <= 0) {
      this.pulseTimer = form.pulseInterval;
      return true;
    }
    return false;
  }

  takeDamage(amount: number): boolean {
    if (!this.alive || this.invuln > 0) return false;
    let left = amount;
    let applied = 0;
    if (this.stats.shield > 0) {
      const absorb = Math.min(this.stats.shield, left);
      this.stats.shield -= absorb;
      left -= absorb;
      applied += absorb;
    }
    if (left > 0) {
      this.stats.hp -= left;
      applied += left;
    }
    this.lastDamageTaken = applied;
    this.invuln = BALANCE.invulnOnHit;
    this.flashMat.emissiveIntensity = 1.2;
    if (this.stats.hp <= 0) {
      this.stats.hp = 0;
    }
    return true;
  }

  healOnKill(): void {
    if (this.stats.lifeSteal > 0) {
      this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + this.stats.maxHp * this.stats.lifeSteal);
    }
    if (this.shieldOnKill > 0 && this.stats.shieldMax > 0) {
      this.stats.shield = Math.min(this.stats.shieldMax, this.stats.shield + this.shieldOnKill);
    }
  }

  addXp(amount: number): boolean {
    this.xp += amount * this.stats.xpMul;
    let leveled = false;
    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.level += 1;
      this.xpToNext = xpToNextForLevel(this.level);
      leveled = true;
    }
    return leveled;
  }

  dispose(): void {
    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        const m = obj.material;
        if (Array.isArray(m)) m.forEach((x) => x.dispose());
        else m.dispose();
      }
    });
  }
}
