import * as THREE from 'three';
import { gemFrames } from '../visual/sprites';

export class ExperienceOrb {
  readonly mesh: THREE.Sprite;
  private readonly material: THREE.SpriteMaterial;
  private readonly frames: [THREE.Texture, THREE.Texture];
  active = false;
  value = 1;
  private bob = 0;
  private readonly aspect: number;
  private readonly baseH = 0.64;
  private scaleMul = 1;

  constructor() {
    this.frames = gemFrames();
    const img = this.frames[0].image as HTMLCanvasElement;
    this.aspect = img.width / img.height;
    this.material = new THREE.SpriteMaterial({
      map: this.frames[0],
      transparent: true,
      alphaTest: 0.15,
      depthWrite: false,
      toneMapped: false,
    });
    this.mesh = new THREE.Sprite(this.material);
    this.mesh.center.set(0.5, 0.5);
    this.mesh.renderOrder = 2;
    this.mesh.visible = false;
  }

  spawn(x: number, z: number, value: number): void {
    this.active = true;
    this.value = value;
    this.bob = Math.random() * Math.PI * 2;
    this.scaleMul = 0.75 + Math.min(1.35, value * 0.12);
    this.mesh.visible = true;
    this.mesh.position.set(x, 0.46, z);
    this.applyScale(1);
  }

  update(dt: number): void {
    if (!this.active) return;
    this.bob += dt * 4;
    this.mesh.position.y = 0.42 + Math.sin(this.bob) * 0.1;
    const frame = Math.floor(this.bob * 1.4) % 2;
    const tex = this.frames[frame];
    if (this.material.map !== tex) this.material.map = tex;
    this.applyScale(1 + Math.sin(this.bob * 2) * 0.08);
  }

  private applyScale(pulse: number): void {
    const h = this.baseH * this.scaleMul * pulse;
    this.mesh.scale.set(h * this.aspect, h, 1);
  }

  despawn(): void {
    this.active = false;
    this.mesh.visible = false;
  }

  dispose(): void {
    this.material.dispose();
  }
}
