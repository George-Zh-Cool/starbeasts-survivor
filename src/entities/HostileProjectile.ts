import * as THREE from 'three';
import { projectileFrames } from '../visual/sprites';

/** Enemy / boss bullets that damage the player on contact. */
export class HostileProjectile {
  readonly mesh: THREE.Sprite;
  private readonly material: THREE.SpriteMaterial;
  private readonly frames: [THREE.Texture, THREE.Texture];
  active = false;
  damage = 0;
  life = 0;
  radius = 0.28;
  readonly velocity = new THREE.Vector3();
  private frameT = 0;
  private readonly aspect: number;
  private readonly baseH = 0.62;

  constructor() {
    this.frames = projectileFrames('thorn');
    const img = this.frames[0].image as HTMLCanvasElement;
    this.aspect = img.width / img.height;
    this.material = new THREE.SpriteMaterial({
      map: this.frames[0],
      color: 0xff4d88,
      transparent: true,
      alphaTest: 0.15,
      depthWrite: false,
      toneMapped: false,
    });
    this.mesh = new THREE.Sprite(this.material);
    this.mesh.center.set(0.5, 0.5);
    this.mesh.renderOrder = 6;
    this.mesh.scale.set(this.baseH * this.aspect, this.baseH, 1);
    this.mesh.visible = false;
  }

  spawn(
    x: number,
    y: number,
    z: number,
    dirX: number,
    dirZ: number,
    speed: number,
    damage: number,
    color: number,
    life = 3.2,
  ): void {
    this.active = true;
    this.mesh.visible = true;
    this.mesh.position.set(x, y, z);
    this.velocity.set(dirX, 0, dirZ).normalize().multiplyScalar(speed);
    this.damage = damage;
    this.life = life;
    this.frameT = Math.random();
    this.material.color.setHex(color);
  }

  update(dt: number): void {
    if (!this.active) return;
    this.mesh.position.x += this.velocity.x * dt;
    this.mesh.position.z += this.velocity.z * dt;
    this.frameT += dt;
    const tex = this.frames[Math.floor(this.frameT * 10) % 2];
    if (this.material.map !== tex) this.material.map = tex;
    const pulse = 1 + Math.sin(this.frameT * 14) * 0.1;
    this.mesh.scale.set(this.baseH * this.aspect * pulse, this.baseH * pulse, 1);
    this.life -= dt;
    if (this.life <= 0) this.despawn();
  }

  despawn(): void {
    this.active = false;
    this.mesh.visible = false;
  }

  dispose(): void {
    this.material.dispose();
  }
}
