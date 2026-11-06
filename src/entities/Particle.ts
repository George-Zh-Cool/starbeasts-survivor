import * as THREE from 'three';
import { sparkTexture } from '../visual/sprites';

export class HitParticle {
  readonly mesh: THREE.Sprite;
  private readonly material: THREE.SpriteMaterial;
  active = false;
  life = 0;
  maxLife = 0.4;
  readonly velocity = new THREE.Vector3();
  private pop = false;
  private baseScale = 0.3;

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

  spawn(x: number, y: number, z: number, color: number, power = 1, pop = false): void {
    this.active = true;
    this.pop = pop;
    this.maxLife = pop ? 0.12 + Math.random() * 0.05 : 0.2 + Math.random() * 0.14;
    this.life = this.maxLife;
    this.mesh.visible = true;
    this.mesh.position.set(x, y, z);
    this.baseScale = (pop ? 0.78 : 0.48) * power * (0.85 + Math.random() * 0.35);
    this.mesh.scale.setScalar(this.baseScale * (pop ? 0.45 : 1));
    this.material.map = sparkTexture(pop ? 1 : Math.floor(Math.random() * 3));
    this.material.color.setHex(color);
    this.material.opacity = 1;
    this.material.rotation = Math.random() * Math.PI;
    const a = Math.random() * Math.PI * 2;
    const sp = (pop ? 1.4 : 5.5) * power * (0.75 + Math.random() * 0.5);
    this.velocity.set(Math.cos(a) * sp, (pop ? 0.4 : 2.2) + Math.random() * (pop ? 0.6 : 3.2), Math.sin(a) * sp);
  }

  update(dt: number): void {
    if (!this.active) return;
    this.velocity.y -= (this.pop ? 2 : 16) * dt;
    this.mesh.position.x += this.velocity.x * dt;
    this.mesh.position.y += this.velocity.y * dt;
    this.mesh.position.z += this.velocity.z * dt;
    this.material.rotation += dt * (this.pop ? 2 : 10);
    this.life -= dt;
    const t = Math.max(0, this.life / this.maxLife);
    this.material.opacity = t;
    if (this.pop) {
      const grow = 1 - t;
      this.mesh.scale.setScalar(this.baseScale * (0.45 + grow * 1.15));
    } else {
      this.mesh.scale.multiplyScalar(0.96);
    }
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
