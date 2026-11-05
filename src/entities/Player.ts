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
import { PixelActor } from '../visual/sprites';
import { makeGroundRing, makeShadow } from '../visual/pixelScene';

export class Player {
  readonly group: THREE.Group;
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
  private hurtFlash = 0;
  private pulseTimer = 0;
  private readonly modelRoot: THREE.Group;
  private animTime = 0;
  private readonly actor: PixelActor;
  private readonly footRing: THREE.Mesh;

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
    this.actor = new PixelActor(def.shape, undefined, 5);
    this.modelRoot = new THREE.Group();
    this.modelRoot.add(this.actor.sprite);
    this.group.add(this.modelRoot);

    const shadow = makeShadow(Math.max(0.85, this.actor.width * 0.78));
    this.group.add(shadow);
    this.footRing = makeGroundRing(0.78, def.accent, 0.62);
    this.group.add(this.footRing);
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
    if (this.hurtFlash > 0) this.hurtFlash -= dt;
    if (this.slowTimer > 0) {
      this.slowTimer -= dt;
      if (this.slowTimer <= 0) {
        this.slowTimer = 0;
        this.slowFactor = 1;
      }
    }
    const spd = this.stats.moveSpeed * (this.slowTimer > 0 ? this.slowFactor : 1);
    const len = Math.hypot(mx, mz);
    const moving = len > 0.05;
    if (moving) {
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
    if (Math.abs(this.facing.x) > 0.12) this.actor.setFacing(this.facing.x > 0);

    const tier = 1 + this.weaponTier * 0.05;
    const breath = 1 + Math.sin(this.animTime * 3.2) * 0.028;
    this.modelRoot.scale.set(tier * breath, tier * breath, 1);
    this.actor.place(this.animTime, moving);
    const blink = this.invuln > 0 && Math.sin(this.invuln * 26) > 0.15;
    this.actor.flash(this.hurtFlash > 0 ? 1 : 0);
    this.actor.setOpacity(blink ? 0.42 : 1);
    const ringMat = this.footRing.material as THREE.MeshBasicMaterial;
    ringMat.opacity = 0.42 + Math.sin(this.animTime * 4) * 0.12;

    if (this.invuln > 0) this.invuln -= dt;
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
    this.hurtFlash = 0.12;
    if (this.stats.hp <= 0) this.stats.hp = 0;
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
    this.actor.dispose();
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
