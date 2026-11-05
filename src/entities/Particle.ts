import * as THREE from 'three';
import { sparkTexture } from '../visual/sprites';

export class HitParticle {
  readonly mesh: THREE.Sprite;
  private readonly material: THREE.SpriteMaterial;
  active = false;
  life = 0;
  maxLife = 0.4;
  readonly velocity = new THREE.Vector3();

  constructor() {
    this.material = new THREE.SpriteMaterial({
      map: sparkTexture(0),
      transparent: true,
      opacity: 1,
      depthWrite: false,
      toneMapped: false,
    });
    this.mesh = new THREE.Sprite(this.material);
    this.mesh.center.set(0.5, 0.5);
    this.mesh.renderOrder = 7;
    this.mesh.visible = false;
  }

  spawn(x: number, y: number, z: number, color: number): void {
    this.active = true;
    this.maxLife = 0.38 + Math.random() * 0.32;
    this.life = this.maxLife;
    this.mesh.visible = true;
    this.mesh.position.set(x, y, z);
    this.mesh.scale.setScalar(0.16 + Math.random() * 0.28);
    this.material.map = sparkTexture(Math.floor(Math.random() * 3));
    this.material.color.setHex(color);
    this.material.opacity = 1;
    this.material.rotation = Math.random() * Math.PI;
    const a = Math.random() * Math.PI * 2;
    const sp = 3.5 + Math.random() * 6;
    this.velocity.set(Math.cos(a) * sp, 2.5 + Math.random() * 4.5, Math.sin(a) * sp);
  }

  update(dt: number): void {
    if (!this.active) return;
    this.velocity.y -= 14 * dt;
    this.mesh.position.x += this.velocity.x * dt;
    this.mesh.position.y += this.velocity.y * dt;
    this.mesh.position.z += this.velocity.z * dt;
    this.material.rotation += dt * 8;
    this.life -= dt;
    const t = Math.max(0, this.life / this.maxLife);
    this.material.opacity = t;
    this.mesh.scale.multiplyScalar(0.97);
    if (this.life <= 0 || this.mesh.position.y < -0.2) this.despawn();
  }

  despawn(): void {
    this.active = false;
    this.mesh.visible = false;
  }

  dispose(): void {
    this.material.dispose();
  }
}
