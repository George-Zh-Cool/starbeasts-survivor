import * as THREE from 'three';
import { projectileFrames, type ShotStyle } from '../visual/sprites';

export class Projectile {
  readonly mesh: THREE.Group;
  private readonly sprite: THREE.Sprite;
  private readonly material: THREE.SpriteMaterial;
  private frames: [THREE.Texture, THREE.Texture];
  active = false;
  damage = 0;
  pierceLeft = 0;
  speed = 0;
  life = 0;
  splashRadius = 0;
  splashRatio = 0;
  chainLeft = 0;
  knockback = 0;
  crit = false;
  readonly velocity = new THREE.Vector3();
  readonly hitEnemies = new Set<number>();
  private baseScale = 1;
  private frameT = 0;
  private readonly aspect: number;
  private readonly baseH = 0.72;

  constructor() {
    this.mesh = new THREE.Group();
    this.frames = projectileFrames('flame');
    const img = this.frames[0].image as HTMLCanvasElement;
    this.aspect = img.width / img.height;
    this.material = new THREE.SpriteMaterial({
      map: this.frames[0],
      transparent: true,
      alphaTest: 0.15,
      depthWrite: false,
      toneMapped: false,
    });
    this.sprite = new THREE.Sprite(this.material);
    this.sprite.center.set(0.5, 0.5);
    this.sprite.renderOrder = 6;
    this.sprite.scale.set(this.baseH * this.aspect, this.baseH, 1);
    this.mesh.add(this.sprite);
    this.mesh.visible = false;
  }

  get position(): THREE.Vector3 {
    return this.mesh.position;
  }

  spawn(
    x: number,
    y: number,
    z: number,
    dirX: number,
    dirZ: number,
    speed: number,
    damage: number,
    pierce: number,
    color: number,
    opts?: {
      life?: number;
      scale?: number;
      splashRadius?: number;
      splashRatio?: number;
      chainLeft?: number;
      knockback?: number;
      crit?: boolean;
      style?: ShotStyle;
    },
  ): void {
    this.active = true;
    this.mesh.visible = true;
    this.mesh.position.set(x, y, z);
    this.velocity.set(dirX, 0, dirZ).normalize().multiplyScalar(speed);
    this.speed = speed;
    this.damage = damage;
    this.pierceLeft = pierce;
    this.life = opts?.life ?? 2.2;
    this.splashRadius = opts?.splashRadius ?? 0;
    this.splashRatio = opts?.splashRatio ?? 0;
    this.chainLeft = opts?.chainLeft ?? 0;
    this.knockback = opts?.knockback ?? 0;
    this.crit = opts?.crit ?? false;
    this.hitEnemies.clear();
    this.baseScale = opts?.scale ?? 1;
    this.mesh.scale.setScalar(this.baseScale);
    this.frameT = 0;
    this.frames = projectileFrames(opts?.style ?? 'flame');
    this.material.map = this.frames[0];
    this.material.color.setHex(color);
    if (this.crit) this.material.color.multiplyScalar(1.35);
  }

  update(dt: number): void {
    if (!this.active) return;
    this.mesh.position.x += this.velocity.x * dt;
    this.mesh.position.z += this.velocity.z * dt;
    this.frameT += dt;
    const frame = Math.floor(this.frameT * 10) % 2;
    const tex = this.frames[frame];
    if (this.material.map !== tex) this.material.map = tex;
    const pulse = 1 + Math.sin(this.frameT * 16) * 0.08;
    this.sprite.scale.set(this.baseH * this.aspect * pulse, this.baseH * pulse, 1);
    this.life -= dt;
    if (this.life <= 0) this.despawn();
  }

  despawn(): void {
    this.active = false;
    this.mesh.visible = false;
    this.hitEnemies.clear();
    this.chainLeft = 0;
  }

  dispose(): void {
    this.material.dispose();
  }
}
