import * as THREE from 'three';
import {
  makeBeastAtlas,
  makeBossPlateAtlas,
  makeCrystalAtlas,
  makeFeatherAtlas,
  makeFurAtlas,
  makeGroundDetailTexture,
  makeGroundTexture,
  makeScaleAtlas,
} from './procTextures';

const cache = new Map<string, THREE.CanvasTexture>();

function toTex(
  key: string,
  make: () => HTMLCanvasElement,
  opts?: { repeat?: number; wrap?: boolean },
): THREE.CanvasTexture {
  const hit = cache.get(key);
  if (hit) return hit;
  const tex = new THREE.CanvasTexture(make());
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  if (opts?.wrap !== false) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  }
  if (opts?.repeat) tex.repeat.set(opts.repeat, opts.repeat);
  tex.needsUpdate = true;
  cache.set(key, tex);
  return tex;
}

export function getCharBodyTexture(shape: 'fox' | 'turtle' | 'falcon', color: number, accent: number): THREE.CanvasTexture {
  const key = `char:${shape}:${color.toString(16)}:${accent.toString(16)}`;
  return toTex(
    key,
    () => {
      if (shape === 'fox') return makeFurAtlas(color, accent);
      if (shape === 'turtle') return makeScaleAtlas(color, accent);
      return makeFeatherAtlas(color, accent);
    },
    { repeat: shape === 'turtle' ? 2 : 1.5 },
  );
}

export function getCharAccentTexture(shape: 'fox' | 'turtle' | 'falcon', color: number, accent: number): THREE.CanvasTexture {
  const key = `charAccent:${shape}:${accent.toString(16)}`;
  return toTex(
    key,
    () => {
      if (shape === 'turtle') return makeScaleAtlas(accent, color, 128);
      if (shape === 'fox') return makeFurAtlas(accent, color, 128);
      return makeFeatherAtlas(accent, color, 128);
    },
    { repeat: 1.2 },
  );
}

export function getEnemyTexture(
  shape: 'crystal' | 'wolf' | 'beetle' | 'elite',
  color: number,
  accent = 0xffd166,
): THREE.CanvasTexture {
  const key = `enemy:${shape}:${color.toString(16)}`;
  return toTex(
    key,
    () => {
      if (shape === 'crystal') return makeCrystalAtlas(color);
      return makeBeastAtlas(color, accent, shape === 'elite' ? 'elite' : shape);
    },
    { repeat: 1.25 },
  );
}

export function getBossTexture(color: number, accent: number): THREE.CanvasTexture {
  const key = `boss:${color.toString(16)}:${accent.toString(16)}`;
  return toTex(key, () => makeBossPlateAtlas(color, accent), { repeat: 1.5 });
}

export function getGroundTexture(): THREE.CanvasTexture {
  return toTex('ground', () => makeGroundTexture(512), { repeat: 8 });
}

export function getGroundDetailTexture(): THREE.CanvasTexture {
  return toTex('groundDetail', () => makeGroundDetailTexture(256), { repeat: 14 });
}
