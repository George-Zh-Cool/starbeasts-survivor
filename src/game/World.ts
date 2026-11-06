import * as THREE from 'three';
import { createBattlefield } from '../visual/pixelScene';

export class World {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  private readonly ground: THREE.Mesh;
  private readonly sky: THREE.Mesh;
  private readonly marks: THREE.Mesh;
  private shakeMag = 0;
  private shakeT = 0;
  private shakeX = 0;
  private shakeY = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x070814);
    this.scene.fog = new THREE.FogExp2(0x12162c, 0.009);

    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 140);
    this.camera.position.set(0, 14.6, 11.4);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = false;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    const hemi = new THREE.HemisphereLight(0xb7c6ff, 0x1a1424, 1.05);
    this.scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffe6c4, 0.85);
    dir.position.set(12, 22, 8);
    this.scene.add(dir);

    const field = createBattlefield();
    this.sky = field.sky;
    this.ground = field.ground;
    this.marks = field.marks;
    this.scene.add(this.sky);
    this.scene.add(this.ground);
    this.scene.add(this.marks);

    this.resize();
    window.addEventListener('resize', this.resize);
  }

  private resize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  };

  /** 短促位移，上限压低，避免连续命中把镜头甩晕。 */
  impulse(amount: number): void {
    this.shakeMag = Math.min(0.16, Math.max(this.shakeMag, amount));
  }

  follow(target: THREE.Vector3, dt: number, shakeDt = dt): void {
    this.camera.position.x -= this.shakeX;
    this.camera.position.y -= this.shakeY;
    const desired = new THREE.Vector3(target.x, 14.6, target.z + 11.4);
    this.camera.position.lerp(desired, 1 - Math.exp(-dt * 16));
    this.shakeT += shakeDt;
    this.shakeX = 0;
    this.shakeY = 0;
    if (this.shakeMag > 0.002) {
      const s = this.shakeMag;
      this.shakeX = Math.sin(this.shakeT * 16.5) * s;
      this.shakeY = Math.cos(this.shakeT * 13.2) * s * 0.4;
      this.shakeMag *= Math.exp(-shakeDt * 11);
    }
    this.camera.position.x += this.shakeX;
    this.camera.position.y += this.shakeY;
    const look = new THREE.Vector3(target.x + this.shakeX, 0.6, target.z);
    this.camera.lookAt(look);
  }

  screenToGround(ndcX: number, ndcY: number, out: THREE.Vector3): void {
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    raycaster.ray.intersectPlane(plane, out);
  }

  worldToScreen(x: number, y: number, z: number, out: { x: number; y: number }): boolean {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    if (v.z > 1) return false;
    out.x = (v.x * 0.5 + 0.5) * window.innerWidth;
    out.y = (-v.y * 0.5 + 0.5) * window.innerHeight;
    return true;
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    window.removeEventListener('resize', this.resize);
    this.renderer.dispose();
    for (const mesh of [this.ground, this.sky, this.marks]) {
      mesh.geometry.dispose();
      const mat = mesh.material;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat.dispose();
    }
  }
}
