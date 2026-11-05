/** 像素地面、夜空、脚底阴影和能量环。贴图共用，材质按实例分开。 */
import * as THREE from 'three';
import { canvasTexture, paintGround, paintMarks, paintRing, paintShadow, paintSky } from './pixelDraw';

interface SceneTextures {
  ground: THREE.CanvasTexture;
  sky: THREE.CanvasTexture;
  marks: THREE.CanvasTexture;
  ring: THREE.CanvasTexture;
  shadow: THREE.CanvasTexture;
}

let cache: SceneTextures | null = null;

function textures(): SceneTextures {
  if (cache) return cache;
  const ground = canvasTexture(paintGround(), true);
  ground.repeat.set(4, 4);
  cache = {
    ground,
    sky: canvasTexture(paintSky(), false),
    marks: canvasTexture(paintMarks(), false),
    ring: canvasTexture(paintRing(), false),
    shadow: canvasTexture(paintShadow(), false),
  };
  return cache;
}

export function createBattlefield(): { sky: THREE.Mesh; ground: THREE.Mesh; marks: THREE.Mesh } {
  const tex = textures();
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(96, 20, 12),
    new THREE.MeshBasicMaterial({ map: tex.sky, side: THREE.BackSide, fog: false, toneMapped: false }),
  );
  sky.renderOrder = -10;

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 120),
    new THREE.MeshBasicMaterial({ map: tex.ground, toneMapped: false }),
  );
  ground.rotation.x = -Math.PI / 2;

  const marks = new THREE.Mesh(
    new THREE.PlaneGeometry(86, 86),
    new THREE.MeshBasicMaterial({
      map: tex.marks,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  marks.rotation.x = -Math.PI / 2;
  marks.position.y = 0.02;
  marks.renderOrder = 1;

  return { sky, ground, marks };
}

export function makeGroundRing(radius: number, color: number, opacity: number): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.MeshBasicMaterial({
      map: textures().ring,
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.05;
  mesh.scale.setScalar(radius);
  mesh.renderOrder = 1;
  return mesh;
}

export function makeShadow(width: number): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      map: textures().shadow,
      color: 0x000000,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.03;
  mesh.scale.set(width, width * 0.55, 1);
  mesh.renderOrder = 1;
  return mesh;
}
