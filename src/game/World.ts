import * as THREE from 'three';
import { getGroundDetailTexture, getGroundTexture } from '../visual/textures';

export class World {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  private readonly grid: THREE.GridHelper;
  private readonly ground: THREE.Mesh;
  private readonly hemi: THREE.HemisphereLight;
  private readonly dir: THREE.DirectionalLight;
  private readonly groundTex: THREE.CanvasTexture;

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x070b16);
    this.scene.fog = new THREE.FogExp2(0x0a1224, 0.018);

    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 120);
    this.camera.position.set(0, 18, 14);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.hemi = new THREE.HemisphereLight(0x9eb6ff, 0x1a1020, 0.7);
    this.scene.add(this.hemi);

    this.dir = new THREE.DirectionalLight(0xffe6c8, 1.15);
    this.dir.position.set(12, 24, 8);
    this.dir.castShadow = true;
    this.dir.shadow.mapSize.set(1024, 1024);
    this.dir.shadow.camera.near = 1;
    this.dir.shadow.camera.far = 60;
    this.dir.shadow.camera.left = -25;
    this.dir.shadow.camera.right = 25;
    this.dir.shadow.camera.top = 25;
    this.dir.shadow.camera.bottom = -25;
    this.scene.add(this.dir);

    // 天穹淡色半球
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(90, 24, 16),
      new THREE.MeshBasicMaterial({
        color: 0x10182c,
        side: THREE.BackSide,
        fog: false,
      }),
    );
    this.scene.add(sky);

    this.groundTex = getGroundTexture();

    const groundMat = new THREE.MeshStandardMaterial({
      map: this.groundTex,
      color: 0xffffff,
      roughness: 0.94,
      metalness: 0.04,
    });
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), groundMat);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);

    // 第二层弱细节噪点（半透明，不抢戏）
    const detailTex = getGroundDetailTexture();
    const detail = new THREE.Mesh(
      new THREE.PlaneGeometry(120, 120),
      new THREE.MeshBasicMaterial({
        map: detailTex,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
      }),
    );
    detail.rotation.x = -Math.PI / 2;
    detail.position.y = 0.012;
    this.scene.add(detail);

    this.grid = new THREE.GridHelper(80, 40, 0x334066, 0x1a2238);
    this.grid.position.y = 0.02;
    const gmat = this.grid.material as THREE.Material | THREE.Material[];
    if (Array.isArray(gmat)) {
      gmat.forEach((m) => {
        m.transparent = true;
        m.opacity = 0.35;
      });
    } else {
      gmat.transparent = true;
      gmat.opacity = 0.35;
    }
    this.scene.add(this.grid);

    // Decorative rings — 星环氛围
    for (let i = 1; i <= 3; i++) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(8 * i - 0.1, 8 * i + 0.02, 64),
        new THREE.MeshBasicMaterial({
          color: i === 2 ? 0x5a7ab8 : 0x3a4a78,
          transparent: true,
          opacity: 0.14 + i * 0.02,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.03;
      this.scene.add(ring);
    }

    // 边缘雾灯：低矮点光暗示地平线
    const rim = new THREE.PointLight(0x4a6cff, 0.55, 55, 2);
    rim.position.set(0, 3, -28);
    this.scene.add(rim);
    const rim2 = new THREE.PointLight(0xff6b4a, 0.35, 45, 2);
    rim2.position.set(22, 2.5, 10);
    this.scene.add(rim2);

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

  follow(target: THREE.Vector3, dt: number): void {
    const desired = new THREE.Vector3(target.x, 18, target.z + 14);
    this.camera.position.lerp(desired, 1 - Math.pow(0.001, dt));
    const look = new THREE.Vector3(target.x, 0.5, target.z);
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
    this.ground.geometry.dispose();
    (this.ground.material as THREE.Material).dispose();
    // groundTex 来自共享缓存，不在此 dispose
  }
}
