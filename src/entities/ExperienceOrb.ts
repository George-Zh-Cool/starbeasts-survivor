import * as THREE from 'three';

export class ExperienceOrb {
  readonly mesh: THREE.Group;
  private readonly core: THREE.Mesh;
  private readonly glow: THREE.Mesh;
  active = false;
  value = 1;
  private bob = 0;

  constructor() {
    this.mesh = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: 0x80ffdb,
      emissive: 0x2ec4b6,
      emissiveIntensity: 1.0,
      roughness: 0.25,
      metalness: 0.45,
    });
    this.core = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), mat);
    this.glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0x80ffdb, transparent: true, opacity: 0.3, depthWrite: false }),
    );
    this.mesh.add(this.core);
    this.mesh.add(this.glow);
    this.mesh.visible = false;
  }

  spawn(x: number, z: number, value: number): void {
    this.active = true;
    this.value = value;
    this.bob = Math.random() * Math.PI * 2;
    this.mesh.visible = true;
    this.mesh.position.set(x, 0.35, z);
    this.mesh.scale.setScalar(0.7 + Math.min(1.5, value * 0.15));
  }

  update(dt: number): void {
    if (!this.active) return;
    this.bob += dt * 4;
    this.mesh.position.y = 0.35 + Math.sin(this.bob) * 0.14;
    this.core.rotation.y += dt * 2.8;
    this.core.rotation.x += dt * 1.2;
    this.glow.scale.setScalar(1 + Math.sin(this.bob * 2) * 0.15);
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
