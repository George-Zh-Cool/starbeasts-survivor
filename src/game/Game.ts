import * as THREE from 'three';
import { World } from './World';
import { Input } from './Input';
import { ObjectPool } from './ObjectPool';
import { Spawner } from './Spawner';
import { Combat } from './Combat';
import { EventDirector } from './EventDirector';
import { recordLocalRun, submitRun } from './HighScores';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { Projectile } from '../entities/Projectile';
import { ExperienceOrb } from '../entities/ExperienceOrb';
import { HitParticle } from '../entities/Particle';
import { Boss } from '../entities/Boss';
import { HostileProjectile } from '../entities/HostileProjectile';
import type { CharacterDef } from '../data/characters';
import { applyNewSynergies, pickRandomUpgrades, type UpgradeDef } from '../data/upgrades';
import { HUD } from '../ui/HUD';
import { CharacterSelect } from '../ui/CharacterSelect';
import { UpgradeModal } from '../ui/UpgradeModal';
import { GameOver } from '../ui/GameOver';
import { audio } from '../audio/Audio';
import { ObstacleField } from './Obstacles';
import { VirtualJoystick } from '../ui/VirtualJoystick';
import { FloatTexts } from '../ui/FloatTexts';
import { BALANCE, formatDifficultyDebug } from '../data/balance';

type Phase = 'select' | 'playing' | 'paused' | 'levelup' | 'gameover';

export class Game {
  private readonly canvas: HTMLCanvasElement;
  private readonly uiRoot: HTMLElement;
  private readonly world: World;
  private readonly input: Input;
  private readonly hud: HUD;
  private readonly upgradeModal = new UpgradeModal();
  private readonly gameOverUi = new GameOver();
  private readonly obstacleField: ObstacleField;
  private readonly joystick: VirtualJoystick;
  private readonly floats: FloatTexts;
  private readonly screenTmp = { x: 0, y: 0 };

  private phase: Phase = 'select';
  private player: Player | null = null;
  private selectedDef: CharacterDef | null = null;
  private charSelect: CharacterSelect | null = null;

  private readonly enemies: Enemy[] = [];
  private readonly projectiles: Projectile[] = [];
  private readonly orbs: ExperienceOrb[] = [];
  private readonly particles: HitParticle[] = [];
  private readonly hostile: HostileProjectile[] = [];
  private readonly boss = new Boss();

  private readonly enemyPool = new ObjectPool(
    () => new Enemy(),
    (e) => e.despawn(),
    64,
  );
  private readonly projPool = new ObjectPool(
    () => new Projectile(),
    (p) => p.despawn(),
    48,
  );
  private readonly orbPool = new ObjectPool(
    () => new ExperienceOrb(),
    (o) => o.despawn(),
    64,
  );
  private readonly partPool = new ObjectPool(
    () => new HitParticle(),
    (p) => p.despawn(),
    80,
  );

  private spawner!: Spawner;
  private combat!: Combat;
  private events!: EventDirector;
  private elapsed = 0;
  private pendingLevels = 0;
  private raf = 0;
  private lastTs = 0;
  private readonly lookPoint = new THREE.Vector3();
  private running = false;
  private briefRewardTimer = 0;
  private rewardActive = false;
  private rewardMoveBoost = 0;
  private rewardIntervalFactor = 1;
  private spawnProtectLeft = 0;
  private showDiffDebug = false;
  private hitStop = 0;
  private bossHitCd = 0;
  private realDt = 0;

  constructor(canvas: HTMLCanvasElement, uiRoot: HTMLElement) {
    this.canvas = canvas;
    this.uiRoot = uiRoot;
    this.world = new World(canvas);
    this.input = new Input(canvas);
    this.obstacleField = new ObstacleField(this.world.scene);
    this.joystick = new VirtualJoystick(uiRoot);
    this.input.bindJoystick(this.joystick);
    this.hud = new HUD(uiRoot);
    this.hud.setVisible(false);
    this.floats = new FloatTexts(uiRoot);

    this.spawner = new Spawner(this.world.scene, this.enemyPool, this.enemies);
    this.combat = new Combat(
      this.world.scene,
      this.projectiles,
      this.projPool,
      this.particles,
      this.partPool,
      this.orbs,
      this.orbPool,
    );
    this.events = new EventDirector(this.world.scene, this.enemyPool, this.enemies, this.boss);
    this.combat.floatHook = (kind, amount, x, z) => {
      if (!this.world.worldToScreen(x, 1.1, z, this.screenTmp)) return;
      const label = kind === 'crit' ? `暴击 ${amount}` : kind === 'hurt' ? `-${amount}` : String(amount);
      this.floats.spawn(this.screenTmp.x, this.screenTmp.y, label, kind);
    };
    this.combat.impactHook = (kind) => this.onImpact(kind);
    window.addEventListener('keydown', this.onPauseKey);
    this.spawner.setObstacles(this.obstacleField);
    this.events.setObstacles(this.obstacleField);
    this.events.setHooks({
      onBossWarn: (name) => {
        audio.playBossWarn();
        this.hud.showEventBanner(`⚠ Boss 来袭 — ${name}`, 'boss', 3.5);
      },
      onEliteTide: () => {
        audio.playEliteTide();
        this.hud.showEventBanner('⚔ 精英潮来袭！短时高密度刷怪', 'tide', 3.0);
      },
      onBossSpawned: () => {
        this.spawner.bossPresent = true;
      },
      onBossDefeated: (name, xp) => {
        audio.playBossDefeat();
        this.hud.showEventBanner(`✦ 击败 ${name}！大量经验与短暂强化`, 'reward', 3.2);
        const player = this.player;
        if (player) {
          const bx = this.boss.group.position.x;
          const bz = this.boss.group.position.z;
          const chunks = 8;
          for (let i = 0; i < chunks; i++) {
            const a = (i / chunks) * Math.PI * 2;
            this.combat.spawnOrb(bx + Math.cos(a) * 1.5, bz + Math.sin(a) * 1.5, Math.max(2, Math.floor(xp / chunks)));
          }
          this.applyBriefReward(player);
        }
        this.spawner.bossPresent = false;
      },
    });

    this.showCharacterSelect();
    this.running = true;
    this.lastTs = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  private showCharacterSelect(): void {
    this.phase = 'select';
    this.joystick.setVisible(false);
    this.hud.setVisible(false);
    this.upgradeModal.hide();
    this.gameOverUi.hide();
    this.clearRun();
    this.charSelect?.dispose();
    this.charSelect = new CharacterSelect(this.uiRoot, (def) => {
      this.selectedDef = def;
      this.charSelect?.dispose();
      this.charSelect = null;
      this.startRun(def);
    });
  }

  private startRun(def: CharacterDef): void {
    audio.unlock();
    this.clearRun();
    this.selectedDef = def;
    this.player = new Player(def);
    this.world.scene.add(this.player.group);
    this.combat.setupAura(this.player);
    this.spawner.reset();
    this.events.reset();
    this.elapsed = 0;
    this.hitStop = 0;
    this.bossHitCd = 0;
    this.pendingLevels = 0;
    this.briefRewardTimer = 0;
    this.rewardActive = false;
    this.rewardMoveBoost = 0;
    this.rewardIntervalFactor = 1;
    this.obstacleField.regenerate();
    this.phase = 'playing';
    this.spawnProtectLeft = BALANCE.spawnProtectSec;
    this.player.invuln = BALANCE.spawnProtectSec;
    this.hud.setVisible(true);
    this.hud.hideBossBar();
    this.hud.setPausedBanner('protect');
    this.floats.clear();
    this.joystick.setVisible(true);
    this.canvas.focus();
    if (audio.isBgmEnabled && !audio.isMuted) audio.startBgm();
  }

  private clearRun(): void {
    this.obstacleField.clear();
    this.joystick.setVisible(false);
    if (this.player) {
      this.world.scene.remove(this.player.group);
      this.player.dispose();
      this.player = null;
    }
    this.combat.clearAura();

    if (this.boss.active) this.boss.despawn();
    if (this.boss.group.parent) this.world.scene.remove(this.boss.group);
    if (this.boss.fxRoot.parent) this.world.scene.remove(this.boss.fxRoot);

    while (this.enemies.length) {
      const e = this.enemies.pop()!;
      e.despawn();
      this.world.scene.remove(e.mesh);
      this.enemyPool.release(e);
    }
    while (this.projectiles.length) {
      const p = this.projectiles.pop()!;
      p.despawn();
      this.projPool.release(p);
    }
    while (this.orbs.length) {
      const o = this.orbs.pop()!;
      o.despawn();
      this.orbPool.release(o);
    }
    while (this.particles.length) {
      const p = this.particles.pop()!;
      p.despawn();
      this.partPool.release(p);
    }
    while (this.hostile.length) {
      const h = this.hostile.pop()!;
      h.despawn();
      if (h.mesh.parent) h.mesh.parent.remove(h.mesh);
      h.dispose();
    }
  }

  private frame = (ts: number): void => {
    if (!this.running) return;
    const realDt = Math.min(0.05, (ts - this.lastTs) / 1000);
    this.lastTs = ts;
    this.realDt = realDt;
    let dt = realDt;
    if (this.phase === 'playing' && this.hitStop > 0) {
      this.hitStop = Math.max(0, this.hitStop - realDt);
      dt = realDt * 0.08;
    }
    this.update(dt);
    this.world.render();
    this.raf = requestAnimationFrame(this.frame);
  };

  private addHitStop(sec: number): void {
    this.hitStop = Math.min(0.05, this.hitStop + sec);
  }

  private onImpact(kind: 'hit' | 'kill' | 'bosshit' | 'hurt'): void {
    if (kind === 'hit') {
      audio.playHit();
      return;
    }
    if (kind === 'kill') {
      this.addHitStop(0.032);
      this.world.impulse(0.05);
      return;
    }
    if (kind === 'bosshit') {
      if (this.bossHitCd > 0) return;
      this.bossHitCd = 0.12;
      this.addHitStop(0.02);
      this.world.impulse(0.04);
      return;
    }
    this.addHitStop(0.026);
    this.world.impulse(0.07);
  }

  private update(dt: number): void {
    if (this.phase === 'select' || this.phase === 'gameover') {
      return;
    }

    const player = this.player;
    if (!player) return;

    this.hud.tickBanner(dt);

    if (this.phase === 'levelup' || this.phase === 'paused') {
      this.world.follow(player.position, dt, this.realDt);
      this.refreshHud(player);
      return;
    }

    // playing
    this.elapsed += dt;
    if (this.bossHitCd > 0) this.bossHitCd = Math.max(0, this.bossHitCd - this.realDt);

    if (this.spawnProtectLeft > 0) {
      this.spawnProtectLeft -= dt;
      if (this.spawnProtectLeft <= 0) {
        this.spawnProtectLeft = 0;
        this.hud.setPausedBanner(false);
      }
    }

    if (this.briefRewardTimer > 0) {
      this.briefRewardTimer -= dt;
      if (this.briefRewardTimer <= 0) {
        this.clearBriefReward(player);
      }
    }

    this.world.screenToGround(this.input.ndcX, this.input.ndcY, this.lookPoint);
    player.updateMovement(dt, this.input.moveX, this.input.moveZ, this.lookPoint.x, this.lookPoint.z);

    const lim = 40;
    player.position.x = THREE.MathUtils.clamp(player.position.x, -lim, lim);
    player.position.z = THREE.MathUtils.clamp(player.position.z, -lim, lim);
    this.obstacleField.resolveCircle(player.position, 0.45);

    this.events.update(dt, this.elapsed, player);
    this.spawner.rateMul = this.events.spawnRateMul;
    this.spawner.maxBonus = this.events.maxEnemyBonus;
    this.spawner.bossPresent = !!this.events.activeBoss;
    this.spawner.update(dt, this.elapsed, player);

    for (const e of this.enemies) {
      if (e.active) {
        e.update(dt, player.position.x, player.position.z);
        if (!e.dying) this.obstacleField.resolveCircle(e.mesh.position, e.radius * 0.85);
      }
    }

    // Boss AI + special actions
    const activeBoss = this.events.activeBoss;
    if (activeBoss) {
      const action = activeBoss.update(dt, player.position.x, player.position.z);
      if (action?.type === 'ring') {
        this.fireBossRing(activeBoss, action.count, action.speed, action.damage, action.color);
      } else if (action?.type === 'summon') {
        this.events.spawnMinions(
          activeBoss.group.position.x,
          activeBoss.group.position.z,
          action.count,
          this.elapsed,
        );
      }
      // 冲撞撞碎晶体；平时也与障碍碰撞
      if (activeBoss.isCharging) {
        const smash = this.obstacleField.smashInRadius(
          activeBoss.group.position.x,
          activeBoss.group.position.z,
          activeBoss.radius + 0.9,
        );
        if (smash.broken.length || smash.rocked.length) {
          audio.playSmash();
          for (const o of smash.broken) {
            audio.playCrystalBreak();
            this.combat.fxBurst(o.x, 0.9, o.z, 0x7bdff2);
            this.combat.fxBurst(o.x, 1.2, o.z, 0xffd166);
          }
          for (const o of smash.rocked) {
            this.combat.fxBurst(o.x, 0.6, o.z, 0x8a90a8);
          }
        }
      } else {
        this.obstacleField.resolveCircle(activeBoss.group.position, activeBoss.radius * 0.75);
      }
    }

    this.obstacleField.update(dt);

    this.combat.update(
      dt,
      player,
      this.enemies,
      (enemy) => this.onEnemyKilled(enemy),
      activeBoss,
      () => this.onBossKilled(),
      this.hostile,
      this.obstacleField,
    );

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      if (!this.enemies[i].active) {
        const e = this.enemies[i];
        this.enemies.splice(i, 1);
        this.enemyPool.release(e);
      }
    }

    // XP orbs
    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const orb = this.orbs[i];
      if (!orb.active) {
        this.orbs.splice(i, 1);
        this.orbPool.release(orb);
        continue;
      }
      orb.update(dt);
      const dx = player.position.x - orb.mesh.position.x;
      const dz = player.position.z - orb.mesh.position.z;
      const dist = Math.hypot(dx, dz);
      const pick = player.stats.pickupRadius;
      if (dist < pick * 1.8) {
        const pull = Math.min(1, (pick * 1.8 - dist) / (pick * 1.8));
        orb.mesh.position.x += dx * pull * dt * 8;
        orb.mesh.position.z += dz * pull * dt * 8;
      }
      if (
        dist < 0.7 ||
        Math.hypot(player.position.x - orb.mesh.position.x, player.position.z - orb.mesh.position.z) < 0.7
      ) {
        const leveled = player.addXp(orb.value);
        audio.playPickup();
        orb.despawn();
        this.orbs.splice(i, 1);
        this.orbPool.release(orb);
        if (leveled) {
          this.pendingLevels += 1;
        }
      }
    }

    this.world.follow(player.position, dt, this.realDt);
    this.refreshHud(player);

    if (!player.alive) {
      this.openGameOver();
      return;
    }

    if (this.pendingLevels > 0) {
      this.openLevelUp();
    }
  }


  private applyBriefReward(player: Player): void {
    this.briefRewardTimer = 8;
    if (this.rewardActive) return;
    this.rewardMoveBoost = player.stats.moveSpeed * 0.25;
    player.stats.moveSpeed += this.rewardMoveBoost;
    this.rewardIntervalFactor = 0.75;
    player.stats.attackInterval = Math.max(0.08, player.stats.attackInterval * this.rewardIntervalFactor);
    this.rewardActive = true;
  }

  private clearBriefReward(player: Player): void {
    if (!this.rewardActive) return;
    player.stats.moveSpeed -= this.rewardMoveBoost;
    player.stats.attackInterval /= this.rewardIntervalFactor;
    this.rewardActive = false;
    this.rewardMoveBoost = 0;
    this.rewardIntervalFactor = 1;
  }

  private fireBossRing(
    boss: Boss,
    count: number,
    speed: number,
    damage: number,
    color: number,
  ): void {
    const bx = boss.group.position.x;
    const bz = boss.group.position.z;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const h = new HostileProjectile();
      this.world.scene.add(h.mesh);
      h.spawn(bx, 0.9, bz, Math.cos(a), Math.sin(a), speed, damage, color, 3.5);
      this.hostile.push(h);
    }
  }

  private onEnemyKilled(enemy: Enemy): void {
    const player = this.player;
    if (!player) return;
    player.kills += 1;
    player.healOnKill();
    audio.playKill();
    const x = enemy.mesh.position.x;
    const z = enemy.mesh.position.z;
    this.combat.spawnOrb(x, z, enemy.xp);

    const affix = enemy.affix;
    if (!affix) return;

    // 击杀提示
    this.hud.showEventBanner(`击破词缀 · ${affix.name}`, 'tide', 1.6);

    if (affix.explodeDamage > 0 && affix.explodeRadius > 0) {
      const dx = player.position.x - x;
      const dz = player.position.z - z;
      if (dx * dx + dz * dz <= affix.explodeRadius * affix.explodeRadius) {
        if (player.takeDamage(affix.explodeDamage) && this.combat.floatHook) {
          this.combat.floatHook('hurt', Math.round(player.lastDamageTaken), player.position.x, player.position.z);
        }
        audio.playSmash();
      }
      this.combat.fxBurst(x, 0.7, z, affix.color);
      this.combat.fxBurst(x, 1.0, z, 0xff9f1c);
    }

    if (affix.splitCount > 0 && !enemy.isSplitling) {
      this.spawner.spawnSplitlings(enemy, affix.splitCount, this.elapsed);
      this.combat.fxBurst(x, 0.6, z, affix.color);
    }
  }

  private onBossKilled(): void {
    const player = this.player;
    if (!player) return;
    player.kills += 1;
    player.healOnKill();
    this.addHitStop(0.048);
    this.world.impulse(0.13);
    this.combat.fxBurst(this.boss.group.position.x, 1.1, this.boss.group.position.z, 0xfff6c8);
    this.events.notifyBossDefeated();
  }

  private refreshHud(player: Player): void {
    this.hud.update(
      this.elapsed,
      player.level,
      player.kills,
      player.stats.hp,
      player.stats.maxHp,
      player.xp,
      player.xpToNext,
      player.weaponForm.name,
      player.stats.shield,
      player.stats.shieldMax,
    );
    const b = this.events.activeBoss;
    if (b?.active) {
      this.hud.setBossBar(b.def?.name ?? 'Boss', b.hp, b.maxHp);
    } else {
      this.hud.hideBossBar();
    }
    if (this.showDiffDebug) {
      this.hud.setDebugText(formatDifficultyDebug(this.elapsed, this.spawner.rateMul));
    }
  }


  private pickOptions(): UpgradeDef[] {
    const player = this.player!;
    return pickRandomUpgrades(3, {
      characterId: player.characterId,
      weaponTier: player.weaponTier,
      owned: player.ownedUpgrades,
      activatedSynergies: player.activatedSynergies,
    });
  }

  private announceEvolve(formName: string, auto: boolean): void {
    audio.playEvolve();
    const prefix = auto ? '✦ 武器自动进化' : '✦ 武器进化';
    this.hud.showEventBanner(`${prefix} — ${formName}`, 'reward', 3.0);
    if (this.player?.weaponKind === 'aura') {
      this.combat.setupAura(this.player);
    }
  }


  private onPauseKey = (e: KeyboardEvent): void => {
    if (e.code === 'KeyB') {
      if (this.phase === 'select' || this.phase === 'gameover') return;
      this.showDiffDebug = !this.showDiffDebug;
      this.hud.toggleDebug(this.showDiffDebug);
      if (this.showDiffDebug && this.player) {
        this.hud.setDebugText(formatDifficultyDebug(this.elapsed, this.spawner.rateMul));
      }
      return;
    }
    if (e.code !== 'KeyP' && e.code !== 'Escape') return;
    // 升级弹窗期间不切换暂停（保持选择 UI）
    if (this.phase === 'levelup' || this.phase === 'select' || this.phase === 'gameover') return;
    e.preventDefault();
    if (this.phase === 'playing') {
      this.phase = 'paused';
      this.joystick.setVisible(false);
      this.hud.setPausedBanner('pause');
    } else if (this.phase === 'paused') {
      this.phase = 'playing';
      this.joystick.setVisible(true);
      if (this.spawnProtectLeft > 0) this.hud.setPausedBanner('protect');
      else this.hud.setPausedBanner(false);
    }
  };

  private openLevelUp(): void {
    if (this.phase !== 'playing' || !this.player) return;
    this.phase = 'levelup';
    this.joystick.setVisible(false);
    this.hud.setPausedBanner('levelup');
    audio.playLevelUp();
    const options = this.pickOptions();
    this.upgradeModal.show(this.uiRoot, options, (u) => this.applyUpgrade(u));
  }

  private applyUpgrade(u: UpgradeDef): void {
    if (!this.player) return;
    const player = this.player;

    if (u.kind === 'evolve' || u.id === 'evolve') {
      const form = player.evolveWeapon();
      if (form) this.announceEvolve(form.name, false);
    } else {
      u.apply(player.stats, player.level);
      player.ownedUpgrades.add(u.id);
      const newly = applyNewSynergies(player.ownedUpgrades, player.activatedSynergies, player.stats);
      for (const syn of newly) {
        audio.playSynergy();
        this.hud.showEventBanner(`协同发动 · ${syn.name}：${syn.description}`, 'tide', 3.2);
        if (syn.id === 'crystal_echo') {
          player.shieldOnKill = 8;
        }
      }
    }

    if (player.weaponKind === 'aura') {
      this.combat.setupAura(player);
    }

    this.pendingLevels = Math.max(0, this.pendingLevels - 1);
    if (this.pendingLevels > 0) {
      const options = this.pickOptions();
      this.upgradeModal.show(this.uiRoot, options, (next) => this.applyUpgrade(next));
    } else {
      this.phase = 'playing';
      this.joystick.setVisible(true);
      if (this.spawnProtectLeft > 0) this.hud.setPausedBanner('protect');
      else this.hud.setPausedBanner(false);
      // 升级结束后检查自动进化
      const auto = player.tryAutoEvolve();
      if (auto) this.announceEvolve(auto.name, true);
    }
  }

  private openGameOver(): void {
    this.phase = 'gameover';
    this.joystick.setVisible(false);
    this.hud.setPausedBanner(false);
    this.hud.hideBossBar();
    audio.playGameOver();
    const p = this.player!;
    const name = this.selectedDef?.name ?? '星兽';
    const highs = submitRun(this.elapsed, p.kills);
    recordLocalRun({
      timeSec: this.elapsed,
      kills: p.kills,
      level: p.level,
      characterId: this.selectedDef?.id ?? '',
      characterName: name,
    });
    this.gameOverUi.show(
      this.uiRoot,
      {
        timeSec: this.elapsed,
        level: p.level,
        kills: p.kills,
        characterName: name,
        highs,
      },
      () => {
        if (this.selectedDef) this.startRun(this.selectedDef);
      },
      () => this.showCharacterSelect(),
    );
  }

  dispose(): void {
    this.joystick.dispose();
    this.obstacleField.clear();

    this.running = false;
    cancelAnimationFrame(this.raf);
    this.charSelect?.dispose();
    this.upgradeModal.hide();
    this.gameOverUi.hide();
    this.clearRun();
    this.boss.dispose();
    this.hud.dispose();
    this.input.dispose();
    this.world.dispose();
    audio.stopBgm();
  }
}
