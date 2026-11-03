import * as THREE from 'three';

/** Enemy / boss bullets that damage the player on contact. */
export class HostileProjectile {
  readonly mesh: THREE.Group;
  private readonly core: THREE.Mesh;
  private readonly glow: THREE.Mesh;
  active = false;
  damage = 0;
  life = 0;
  radius = 0.28;
  readonly velocity = new THREE.Vector3();

  constructor() {
    this.mesh = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: 0xff006e,
      emissive: 0xff006e,
      emissiveIntensity: 1.0,
      roughness: 0.28,
      metalness: 0.25,
    });
    this.core = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), mat);
    this.glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.34, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xff006e, transparent: true, opacity: 0.35, depthWrite: false }),
    );
    this.mesh.add(this.core);
    this.mesh.add(this.glow);
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
    const mat = this.core.material as THREE.MeshStandardMaterial;
    mat.color.setHex(color);
    mat.emissive.setHex(color);
    (this.glow.material as THREE.MeshBasicMaterial).color.setHex(color);
  }

  update(dt: number): void {
    if (!this.active) return;
    this.mesh.position.x += this.velocity.x * dt;
    this.mesh.position.z += this.velocity.z * dt;
    this.core.rotation.y += dt * 10;
    this.core.rotation.z += dt * 6;
    this.glow.scale.setScalar(1 + Math.sin(performance.now() * 0.025) * 0.15);
    this.life -= dt;
    if (this.life <= 0) this.despawn();
  }

  despawn(): void {
    this.active = false;
    this.mesh.visible = false;
  }

  dispose(): void {
    this.core.geometry.dispose();
    (this.core.material as THREE.Material).dispose();
    this.glow.geometry.dispose();
    (this.glow.material as THREE.Material).dispose();
  }
}
