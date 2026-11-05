import * as THREE from 'three';
import type { Player } from '../entities/Player';
import type { Enemy } from '../entities/Enemy';
import type { Projectile } from '../entities/Projectile';
import type { ObjectPool } from './ObjectPool';
import type { HitParticle } from '../entities/Particle';
import type { ExperienceOrb } from '../entities/ExperienceOrb';
import type { Boss } from '../entities/Boss';
import type { HostileProjectile } from '../entities/HostileProjectile';
import { audio } from '../audio/Audio';
import type { ObstacleField } from './Obstacles';
import { makeGroundRing } from '../visual/pixelScene';

export class Combat {
  private readonly projectiles: Projectile[];
  private readonly projPool: ObjectPool<Projectile>;
  private readonly scene: THREE.Scene;
  private readonly particles: HitParticle[];
  private readonly partPool: ObjectPool<HitParticle>;
  private readonly orbs: ExperienceOrb[];
  private readonly orbPool: ObjectPool<ExperienceOrb>;
  private auraMeshes: THREE.Mesh[] = [];
  private auraPulse = 0;
  private shootSoundCd = 0;
  private hurtSoundCd = 0;
  private pulseFlash = 0;
  private floatCritCd = 0;
  /** 飘字回调：kind, 数值, 世界 xz */
  floatHook: ((kind: 'hurt' | 'crit' | 'dmg', amount: number, x: number, z: number) => void) | null = null;

  constructor(
    scene: THREE.Scene,
    projectiles: Projectile[],
    projPool: ObjectPool<Projectile>,
    particles: HitParticle[],
    partPool: ObjectPool<HitParticle>,
    orbs: ExperienceOrb[],
    orbPool: ObjectPool<ExperienceOrb>,
  ) {
    this.scene = scene;
    this.projectiles = projectiles;
    this.projPool = projPool;
    this.particles = particles;
    this.partPool = partPool;
    this.orbs = orbs;
    this.orbPool = orbPool;
  }


  private emitHurtFloat(player: Player): void {
    if (!this.floatHook || player.lastDamageTaken <= 0) return;
    this.floatHook('hurt', Math.round(player.lastDamageTaken), player.position.x, player.position.z);
  }

  private emitCritFloat(amount: number, x: number, z: number): void {
    if (!this.floatHook || this.floatCritCd > 0) return;
    this.floatCritCd = 0.08;
    this.floatHook('crit', Math.round(amount), x, z);
  }

  setupAura(player: Player): void {
    if (player.weaponKind !== 'aura') {
      this.clearAura();
      return;
    }
    const rings = Math.max(1, player.weaponForm.auraRings);
    // Rebuild if ring count changed
    if (this.auraMeshes.length !== rings) {
      this.clearAura();
      for (let i = 0; i < rings; i++) {
        const mesh = makeGroundRing(1, i === 0 ? player.accent : player.color, 0.55 - i * 0.12);
        this.scene.add(mesh);
        this.auraMeshes.push(mesh);
      }
    } else {
      for (let i = 0; i < this.auraMeshes.length; i++) {
        const mat = this.auraMeshes[i].material as THREE.MeshBasicMaterial;
        mat.color.setHex(i === 0 ? player.accent : player.color);
      }
    }
  }

  clearAura(): void {
    for (const m of this.auraMeshes) {
      this.scene.remove(m);
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    }
    this.auraMeshes = [];
  }

  update(
    dt: number,
    player: Player,
    enemies: Enemy[],
    onKill: (enemy: Enemy) => void,
    boss: Boss | null,
    onBossKill: () => void,
    hostile: HostileProjectile[],
    obstacles?: ObstacleField,
  ): void {
    this.shootSoundCd = Math.max(0, this.shootSoundCd - dt);
    this.hurtSoundCd = Math.max(0, this.hurtSoundCd - dt);
    this.pulseFlash = Math.max(0, this.pulseFlash - dt);
    this.floatCritCd = Math.max(0, this.floatCritCd - dt);

    if (player.attackCooldown <= 0 && player.alive) {
      const nearest = this.findNearest(player, enemies, boss);
      if (nearest) {
        if (player.weaponKind === 'projectile') {
          this.fireProjectiles(player, nearest.x, nearest.z);
          if (this.shootSoundCd <= 0) {
            audio.playShoot();
            this.shootSoundCd = 0.05;
          }
        }
        player.attackCooldown = player.stats.attackInterval;
      } else if (player.weaponKind === 'aura') {
        player.attackCooldown = player.stats.attackInterval;
      }
    }

    // Aura
    if (player.weaponKind === 'aura' && player.alive) {
      this.auraPulse += dt;
      const form = player.weaponForm;
      const baseR = player.stats.auraRadius;
      const ringCount = Math.max(1, form.auraRings);

      for (let i = 0; i < this.auraMeshes.length; i++) {
        const mesh = this.auraMeshes[i];
        // Dual ring: outer = full radius, inner ≈ 55%
        const rMul = ringCount > 1 ? (i === 0 ? 1 : 0.55) : 1;
        const r = baseR * rMul;
        mesh.position.set(player.position.x, 0.08 + i * 0.02, player.position.z);
        const pulse = 1 + Math.sin(this.auraPulse * 6 + i) * 0.05;
        const flashBoost = this.pulseFlash > 0 ? 1.15 : 1;
        mesh.scale.setScalar(r * pulse * flashBoost);
        const mat = mesh.material as THREE.MeshBasicMaterial;
        mat.opacity = (0.25 + Math.sin(this.auraPulse * 8) * 0.1) * (this.pulseFlash > 0 ? 1.4 : 1);
      }

      const doPulse = player.tickPulse(dt);
      if (doPulse) {
        this.pulseFlash = 0.35;
        this.burst(player.position.x, 0.4, player.position.z, player.accent);
        this.burst(player.position.x, 0.5, player.position.z, player.color);
      }

      const dps = (player.stats.damage * form.damageMul / Math.max(0.12, player.stats.attackInterval)) * dt;
      // Dual ring: damage in either ring band (simplify: full radius still damages, dual just visual + slight dps bump already in damageMul)
      // Pulse: instant bonus damage + knockback in radius
      const pulseDmg = doPulse ? player.stats.damage * form.damageMul * 1.8 : 0;
      const pulseForce = doPulse ? form.pulseForce + player.stats.knockback : 0;

      for (const e of enemies) {
        if (!e.active) continue;
        const dx = e.mesh.position.x - player.position.x;
        const dz = e.mesh.position.z - player.position.z;
        const distSq = dx * dx + dz * dz;
        if (distSq <= (baseR + e.radius) * (baseR + e.radius)) {
          let dmg = dps;
          if (pulseDmg > 0) dmg += pulseDmg;
          let pulseCrit = false;
          // crit chance on pulse ticks only to avoid constant rolling
          if (doPulse && player.stats.critChance > 0 && Math.random() < player.stats.critChance) {
            dmg *= player.stats.critMul;
            pulseCrit = true;
          }
          const died = e.takeDamage(dmg);
          if (pulseCrit) this.emitCritFloat(dmg, e.mesh.position.x, e.mesh.position.z);
          if (pulseForce > 0) e.applyKnockback(dx, dz, pulseForce);
          else if (player.stats.knockback > 0) e.applyKnockback(dx, dz, player.stats.knockback * dt * 4);
          if (died) {
            this.burst(e.mesh.position.x, 0.6, e.mesh.position.z, 0x90e0ef);
            onKill(e);
          }
        }
      }
      if (boss?.active) {
        const dx = boss.group.position.x - player.position.x;
        const dz = boss.group.position.z - player.position.z;
        if (dx * dx + dz * dz <= (baseR + boss.radius) * (baseR + boss.radius)) {
          let dmg = dps + pulseDmg;
          const died = boss.takeDamage(dmg);
          if (died) {
            this.burst(boss.group.position.x, 1.2, boss.group.position.z, 0xffd166);
            onBossKill();
          }
        }
      }
    }

    // Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.update(dt);
      if (!p.active) {
        this.projectiles.splice(i, 1);
        this.projPool.release(p);
        continue;
      }
      let consumed = false;
      for (const e of enemies) {
        if (!e.active || p.hitEnemies.has(e.id)) continue;
        const dx = e.mesh.position.x - p.mesh.position.x;
        const dz = e.mesh.position.z - p.mesh.position.z;
        const rr = e.radius + 0.2 * (p.mesh.scale.x);
        if (dx * dx + dz * dz <= rr * rr) {
          p.hitEnemies.add(e.id);
          const died = e.takeDamage(p.damage);
          if (p.crit) this.emitCritFloat(p.damage, e.mesh.position.x, e.mesh.position.z);
          if (p.knockback > 0) e.applyKnockback(p.velocity.x, p.velocity.z, p.knockback);
          this.burst(e.mesh.position.x, 0.7, e.mesh.position.z, player.color);
          this.applySplash(player, enemies, boss, e.mesh.position.x, e.mesh.position.z, p, onKill, onBossKill, e.id);
          if (died) onKill(e);
          else this.tryChain(enemies, p, e);

          if (p.pierceLeft <= 0) {
            p.despawn();
            consumed = true;
            break;
          }
          p.pierceLeft -= 1;
        }
      }
      if (!consumed && boss?.active && !p.hitEnemies.has(-1)) {
        const dx = boss.group.position.x - p.mesh.position.x;
        const dz = boss.group.position.z - p.mesh.position.z;
        const rr = boss.radius + 0.25;
        if (dx * dx + dz * dz <= rr * rr) {
          p.hitEnemies.add(-1);
          const died = boss.takeDamage(p.damage);
          if (p.crit) this.emitCritFloat(p.damage, boss.group.position.x, boss.group.position.z);
          this.burst(boss.group.position.x, 1.0, boss.group.position.z, player.color);
          this.applySplash(player, enemies, boss, boss.group.position.x, boss.group.position.z, p, onKill, onBossKill, -1);
          if (died) onBossKill();
          if (p.pierceLeft <= 0) {
            p.despawn();
          } else {
            p.pierceLeft -= 1;
          }
        }
      }
    }

    // Obstacles vs projectiles
    if (obstacles) {
      for (let i = this.projectiles.length - 1; i >= 0; i--) {
        const p = this.projectiles[i];
        if (!p.active) continue;
        const hit = obstacles.hitProjectile(
          p.mesh.position.x,
          p.mesh.position.z,
          0.22 * p.mesh.scale.x,
          p.damage,
        );
        if (!hit) continue;
        if (hit.result === 'break') {
          audio.playCrystalBreak();
          this.burst(hit.obstacle.x, 0.8, hit.obstacle.z, 0x7bdff2);
          this.burst(hit.obstacle.x, 1.0, hit.obstacle.z, 0xa0e9ff);
        } else {
          // 岩石或未碎晶体挡弹
          this.burst(p.mesh.position.x, 0.5, p.mesh.position.z, 0x8a90a8);
        }
        p.despawn();
        this.projectiles.splice(i, 1);
        this.projPool.release(p);
      }
    }

    // Hostile
    for (let i = hostile.length - 1; i >= 0; i--) {
      const h = hostile[i];
      h.update(dt);
      if (!h.active) {
        if (h.mesh.parent) h.mesh.parent.remove(h.mesh);
        h.dispose();
        hostile.splice(i, 1);
        continue;
      }
      // hostile vs obstacles
      if (obstacles) {
        const hit = obstacles.hitProjectile(h.mesh.position.x, h.mesh.position.z, 0.25, 12);
        if (hit) {
          if (hit.result === 'break') {
            audio.playCrystalBreak();
            this.burst(hit.obstacle.x, 0.8, hit.obstacle.z, 0x7bdff2);
          }
          h.despawn();
          if (h.mesh.parent) h.mesh.parent.remove(h.mesh);
          h.dispose();
          hostile.splice(i, 1);
          continue;
        }
      }
      if (!player.alive) continue;
      const dx = h.mesh.position.x - player.position.x;
      const dz = h.mesh.position.z - player.position.z;
      const rr = h.radius + 0.4;
      if (dx * dx + dz * dz <= rr * rr) {
        const hit = player.takeDamage(h.damage);
        if (hit) {
          this.emitHurtFloat(player);
          if (this.hurtSoundCd <= 0) {
            audio.playHurt();
            this.hurtSoundCd = 0.35;
          }
        }
        h.despawn();
        if (h.mesh.parent) h.mesh.parent.remove(h.mesh);
        h.dispose();
        hostile.splice(i, 1);
      }
    }

    // Contact
    if (player.alive) {
      for (const e of enemies) {
        if (!e.active) continue;
        const dx = e.mesh.position.x - player.position.x;
        const dz = e.mesh.position.z - player.position.z;
        const rr = e.radius + 0.45;
        if (dx * dx + dz * dz <= rr * rr) {
          const hit = player.takeDamage(e.contactDamage);
          if (hit) {
            this.emitHurtFloat(player);
            if (this.hurtSoundCd <= 0) {
              audio.playHurt();
              this.hurtSoundCd = 0.35;
            }
          }
          if (e.affix && e.affix.frostDuration > 0) {
            player.applySlow(e.affix.frostDuration, e.affix.frostFactor);
          }
        }
      }
      if (boss?.active) {
        const dx = boss.group.position.x - player.position.x;
        const dz = boss.group.position.z - player.position.z;
        const rr = boss.radius + 0.45;
        if (dx * dx + dz * dz <= rr * rr) {
          const hit = player.takeDamage(boss.contactDamage);
          if (hit) {
            this.emitHurtFloat(player);
            if (this.hurtSoundCd <= 0) {
              audio.playHurt();
              this.hurtSoundCd = 0.35;
            }
          }
        }
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.update(dt);
      if (!pt.active) {
        this.particles.splice(i, 1);
        this.partPool.release(pt);
      }
    }
  }

  private applySplash(
    player: Player,
    enemies: Enemy[],
    boss: Boss | null,
    x: number,
    z: number,
    p: Projectile,
    onKill: (e: Enemy) => void,
    onBossKill: () => void,
    skipId: number,
  ): void {
    const form = player.weaponForm;
    const radius = Math.max(p.splashRadius, player.stats.splashRadius, form.splashRadius);
    const ratio = Math.max(p.splashRatio, player.stats.splashRatio, form.splashRatio);
    if (radius <= 0 || ratio <= 0) return;
    const splashDmg = p.damage * ratio;
    this.burst(x, 0.5, z, form.projColor ?? player.accent);
    for (const e of enemies) {
      if (!e.active || e.id === skipId) continue;
      const dx = e.mesh.position.x - x;
      const dz = e.mesh.position.z - z;
      if (dx * dx + dz * dz <= radius * radius) {
        const died = e.takeDamage(splashDmg);
        if (p.knockback > 0) e.applyKnockback(dx, dz, p.knockback * 0.6);
        if (died) onKill(e);
      }
    }
    if (boss?.active && skipId !== -1) {
      const dx = boss.group.position.x - x;
      const dz = boss.group.position.z - z;
      if (dx * dx + dz * dz <= (radius + boss.radius * 0.3) ** 2) {
        const died = boss.takeDamage(splashDmg * 0.7);
        if (died) onBossKill();
      }
    }
  }

  private tryChain(enemies: Enemy[], p: Projectile, from: Enemy): void {
    if (p.chainLeft <= 0) return;
    let best: Enemy | null = null;
    let bestD = 64; // 8^2
    for (const e of enemies) {
      if (!e.active || p.hitEnemies.has(e.id)) continue;
      const dx = e.mesh.position.x - from.mesh.position.x;
      const dz = e.mesh.position.z - from.mesh.position.z;
      const d = dx * dx + dz * dz;
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    if (!best) return;
    p.chainLeft -= 1;
    const dx = best.mesh.position.x - p.mesh.position.x;
    const dz = best.mesh.position.z - p.mesh.position.z;
    const len = Math.hypot(dx, dz) || 1;
    p.velocity.set((dx / len) * p.speed, 0, (dz / len) * p.speed);
    p.life = Math.max(p.life, 0.9);
    // Keep pierce so chain can continue hitting
    p.pierceLeft = Math.max(p.pierceLeft, 1);
  }

  spawnOrb(x: number, z: number, value: number): void {
    const orb = this.orbPool.acquire();
    if (!orb.mesh.parent) this.scene.add(orb.mesh);
    orb.spawn(x, z, value);
    this.orbs.push(orb);
  }

  private fireProjectiles(player: Player, tx: number, tz: number): void {
    const form = player.weaponForm;
    const baseDir = new THREE.Vector3(tx - player.position.x, 0, tz - player.position.z).normalize();
    const count = player.stats.projectileCount + form.extraProjectiles;
    const spread = count > 1 ? 0.2 + Math.min(0.15, count * 0.02) : 0;
    const color = form.projColor ?? player.color;
    const { damage, crit } = player.rollDamage();
    const pierce = player.stats.pierce + form.pierceBonus;
    const splashR = Math.max(form.splashRadius, player.stats.splashRadius);
    const splashRatio = Math.max(form.splashRatio, player.stats.splashRatio);

    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0 : (i / (count - 1) - 0.5) * spread * (count + 1);
      const dir = baseDir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), t);
      const p = this.projPool.acquire();
      if (!p.mesh.parent) this.scene.add(p.mesh);
      p.spawn(
        player.position.x,
        0.7,
        player.position.z,
        dir.x,
        dir.z,
        player.stats.projectileSpeed,
        damage,
        pierce,
        color,
        {
          life: 2.2 + form.lifeBonus,
          scale: form.projScale * (crit ? 1.15 : 1),
          splashRadius: splashR,
          splashRatio,
          chainLeft: form.chainBounces,
          knockback: player.stats.knockback,
          crit,
          style: player.characterId === 'windfalcon' ? 'shard' : 'flame',
        },
      );
      this.projectiles.push(p);
    }
  }

  private findNearest(
    player: Player,
    enemies: Enemy[],
    boss: Boss | null,
  ): { x: number; z: number } | null {
    let bestD = Infinity;
    let best: { x: number; z: number } | null = null;
    for (const e of enemies) {
      if (!e.active) continue;
      const dx = e.mesh.position.x - player.position.x;
      const dz = e.mesh.position.z - player.position.z;
      const d = dx * dx + dz * dz;
      if (d < bestD) {
        bestD = d;
        best = { x: e.mesh.position.x, z: e.mesh.position.z };
      }
    }
    if (boss?.active) {
      const dx = boss.group.position.x - player.position.x;
      const dz = boss.group.position.z - player.position.z;
      const d = dx * dx + dz * dz;
      if (d < bestD * 1.15 || d < 400) {
        best = { x: boss.group.position.x, z: boss.group.position.z };
      }
    }
    return best;
  }

  /** 供 Game 障碍打碎等反馈复用 */
  fxBurst(x: number, y: number, z: number, color: number): void {
    this.burst(x, y, z, color);
  }

  private burst(x: number, y: number, z: number, color: number): void {
    const n = 7;
    for (let i = 0; i < n; i++) {
      const pt = this.partPool.acquire();
      if (!pt.mesh.parent) this.scene.add(pt.mesh);
      pt.spawn(x, y, z, color);
      this.particles.push(pt);
    }
  }
}
