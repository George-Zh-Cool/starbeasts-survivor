import * as THREE from 'three';

export class Projectile {
  readonly mesh: THREE.Group;
  private readonly core: THREE.Mesh;
  private readonly glow: THREE.Mesh;
  private readonly trail: THREE.Mesh;
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

  constructor() {
    this.mesh = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: 0xff9f1c,
      emissive: 0xff6b00,
      emissiveIntensity: 0.95,
      roughness: 0.3,
      metalness: 0.25,
    });
    this.core = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), mat);
    this.glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xff9f1c, transparent: true, opacity: 0.35, depthWrite: false }),
    );
    this.trail = new THREE.Mesh(
      new THREE.ConeGeometry(0.1, 0.45, 5),
      new THREE.MeshBasicMaterial({ color: 0xffc857, transparent: true, opacity: 0.45, depthWrite: false }),
    );
    this.trail.rotation.x = Math.PI / 2;
    this.trail.position.z = 0.28;
    this.mesh.add(this.core);
    this.mesh.add(this.glow);
    this.mesh.add(this.trail);
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
    const mat = this.core.material as THREE.MeshStandardMaterial;
    mat.color.setHex(color);
    mat.emissive.setHex(color);
    mat.emissiveIntensity = this.crit ? 1.5 : 0.95 + (this.baseScale - 1) * 0.4;
    (this.glow.material as THREE.MeshBasicMaterial).color.setHex(color);
    (this.trail.material as THREE.MeshBasicMaterial).color.setHex(color);
    this.mesh.lookAt(x + dirX, y, z + dirZ);
  }

  update(dt: number): void {
    if (!this.active) return;
    this.mesh.position.x += this.velocity.x * dt;
    this.mesh.position.z += this.velocity.z * dt;
    this.core.rotation.y += dt * 12;
    this.glow.scale.setScalar(1 + Math.sin(performance.now() * 0.02) * 0.12);
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
    this.core.geometry.dispose();
    (this.core.material as THREE.Material).dispose();
    this.glow.geometry.dispose();
    (this.glow.material as THREE.Material).dispose();
    this.trail.geometry.dispose();
    (this.trail.material as THREE.Material).dispose();
  }
}
