import * as THREE from 'three';

export class HitParticle {
  readonly mesh: THREE.Mesh;
  active = false;
  life = 0;
  maxLife = 0.4;
  readonly velocity = new THREE.Vector3();

  constructor() {
    const geo = new THREE.OctahedronGeometry(0.1, 0);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1 });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.visible = false;
  }

  spawn(x: number, y: number, z: number, color: number): void {
    this.active = true;
    this.maxLife = 0.38 + Math.random() * 0.32;
    this.life = this.maxLife;
    this.mesh.visible = true;
    this.mesh.position.set(x, y, z);
    this.mesh.scale.setScalar(0.7 + Math.random() * 1.1);
    const mat = this.mesh.material as THREE.MeshBasicMaterial;
    mat.color.setHex(color);
    mat.opacity = 1;
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
    this.mesh.rotation.x += dt * 8;
    this.mesh.rotation.y += dt * 10;
    this.life -= dt;
    const t = Math.max(0, this.life / this.maxLife);
    (this.mesh.material as THREE.MeshBasicMaterial).opacity = t;
    this.mesh.scale.multiplyScalar(0.97);
    if (this.life <= 0 || this.mesh.position.y < -0.2) this.despawn();
  }

  despawn(): void {
    this.active = false;
    this.mesh.visible = false;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
