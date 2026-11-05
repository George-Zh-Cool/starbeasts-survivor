/** 原创星兽像素。侧视或正面剪影，两帧迈步 / 闪烁，再镜像给朝向。 */
import * as THREE from 'three';
import {
  addMargin,
  alignRows,
  canvasTexture,
  mirrorCanvas,
  outline,
  paint,
  scaledDataURL,
  shiftLetters,
  stepLegs,
  swapChars,
} from './pixelDraw';

export type CreatureId =
  | 'fox'
  | 'turtle'
  | 'falcon'
  | 'crystal'
  | 'wolf'
  | 'beetle'
  | 'elite'
  | 'horn'
  | 'core';

export type ShotStyle = 'flame' | 'shard' | 'thorn';

type Align = 'left' | 'center';
type Bob = 'step' | 'hover';

interface Motion {
  step?: boolean;
  flap?: boolean;
  bob?: string[];
  flicker?: [string, string];
}

interface CreatureDef {
  align: Align;
  bob: Bob;
  motion: Motion;
  palette: Record<string, string>;
  fill: string[];
}

const DEFS: Record<CreatureId, CreatureDef> = {
  fox: {
    align: 'left',
    bob: 'step',
    motion: { step: true, bob: ['f', 'F'] },
    palette: {
      k: '#2a120c',
      i: '#ffb089',
      o: '#ff5a36',
      d: '#c7371c',
      e: '#1a0c08',
      n: '#5c2416',
      m: '#ffe0b0',
      F: '#fff6c2',
      f: '#ffd166',
      w: '#fff6ee',
      L: '#ff5a36',
    },
    fill: [
      '........ii..ii........',
      '.......iooiiooi.......',
      '........oooooo........',
      '....FF..odddoo........',
      '...FFFF.ooeeeem.......',
      '...FFf..oowwwmm.......',
      '....F...oooooooo......',
      '........oowwwoooo.....',
      '........oooooooooo....',
      '.........ooo..ooo.....',
      '..........LL..LL......',
      '..........LL..LL......',
    ],
  },
  turtle: {
    align: 'left',
    bob: 'step',
    motion: { step: true },
    palette: {
      k: '#04221e',
      S: '#1aa396',
      p: '#d8fff8',
      h: '#7ee0d0',
      m: '#f4fffc',
      e: '#062420',
      b: '#0e4f48',
      L: '#14685e',
    },
    fill: [
      '..............mm....',
      '.SSSSSSSSSSS.bbmeem.',
      'SSpSSpSSpSSSSbmmmmm.',
      'SSSSSSSSSSSSSSSbbbb.',
      'ShShShShSSSSSSSS....',
      'SSSSSSSSSSSSSSS.....',
      '.LL.SSSSSSSSS.LL....',
      '.LL..SSSSSSS..LL....',
    ],
  },
  falcon: {
    align: 'left',
    bob: 'step',
    motion: { step: true, flap: true },
    palette: {
      k: '#1a0a28',
      c: '#e7c6ff',
      W: '#c77dff',
      b: '#6d28b8',
      d: '#4a148c',
      e: '#140818',
      y: '#ffd166',
      w: '#f6ecff',
      L: '#431270',
    },
    fill: [
      '..........cccc..........',
      '.........cccccc.........',
      '....WWWWWWWWWWWWWW......',
      '...WWWbbbbbbbbbbWWW.....',
      '..WWbbbbbeeeeyyybbW.....',
      '..WWbbbbwwwwbbbbbbW.....',
      '...WWbbbbbbbbbbbbW......',
      '......bbbbbbbbbb........',
      '.......bbb....bbb.......',
      '.......LL......LL.......',
      '.......LL......LL.......',
    ],
  },
  wolf: {
    align: 'left',
    bob: 'step',
    motion: { step: true },
    palette: {
      k: '#1a0612',
      b: '#d42398',
      d: '#7a1058',
      c: '#ffd0ea',
      e: '#ffe56a',
      m: '#2a0816',
      L: '#9a1468',
    },
    fill: [
      '.................bb.',
      '................beeb',
      '..........bbbbbbbbbb',
      '.......bbbbbbbbbbbbb',
      '....bbbccccccccbbbbb',
      '...bbbbbbbbbbbbmmmmm',
      '....bbb..bbb..bbbb..',
      '....LL....LL..LL....',
      '....LL....LL..LL....',
    ],
  },
  beetle: {
    align: 'center',
    bob: 'step',
    motion: { step: true },
    palette: {
      k: '#d8fbff',
      c: '#e8fdff',
      b: '#2f5f98',
      h: '#8ef6ff',
      e: '#ffe56a',
      L: '#10243c',
    },
    fill: [
      'cc..cc',
      'bbbbbbbbbbbb',
      'bbhhhhhhhhhhbb',
      'bhbhbhbhbhbhbh',
      'bbbbbeebbbbbbb',
      'LL.LL....LL.LL',
      'L..L......L..L',
    ],
  },
  crystal: {
    align: 'center',
    bob: 'hover',
    motion: { flicker: ['G', 'C'] },
    palette: {
      k: '#1a1428',
      G: '#f7f3ff',
      C: '#b3a6dc',
      c: '#6a5d90',
      e: '#7cf6ff',
    },
    fill: [
      'GG',
      'GCCG',
      'GCccCG',
      'CCceecCC',
      'CCccccccCC',
      'CCccccCC',
      'CCccCC',
      'CCCC',
      'cc..cc',
      'c....c',
    ],
  },
  elite: {
    align: 'center',
    bob: 'step',
    motion: { step: true, flicker: ['G', 'g'] },
    palette: {
      k: '#1a0610',
      g: '#ffd166',
      G: '#fff6c8',
      b: '#e1066a',
      d: '#8a0040',
      e: '#fff3bf',
      L: '#9a1048',
    },
    fill: [
      'ggGGgg',
      'bbbbbb',
      'bbeeeebb',
      'bbgbbgbb',
      'bbbbbbbbbbbb',
      'bbbbddddbbbb',
      'bbb....bbb',
      'LLL....LLL',
      'LL......LL',
      'LL......LL',
    ],
  },
  horn: {
    align: 'center',
    bob: 'step',
    motion: { step: true, flicker: ['G', 'g'] },
    palette: {
      k: '#2a0a10',
      g: '#ffd166',
      G: '#fff4c2',
      b: '#ff4d6d',
      d: '#b41838',
      e: '#1a0608',
      m: '#ffd5dc',
      L: '#d43458',
    },
    fill: [
      'gG....gG....gG',
      'gg....gg....gg',
      'g......g......g',
      'bbbbbbbb',
      'bbbbbbbbbbbb',
      'bbgbbbbbbbbgbb',
      'bbbbbeeeebbbbb',
      'bbbmmmmmmmmbbb',
      'bbbbddddbbbbbb',
      'bbb......bbb',
      'LLL......LLL',
      'LL........LL',
      'LL........LL',
    ],
  },
  core: {
    align: 'center',
    bob: 'hover',
    motion: { flicker: ['G', 'C'] },
    palette: {
      k: '#140820',
      G: '#e9fbff',
      C: '#4cc9f0',
      b: '#7a2ec4',
      d: '#4a148c',
      e: '#ffffff',
      s: '#e0b0ff',
    },
    fill: [
      'GGCCCCGG',
      'CC....CC',
      'G.bbbbbb.G',
      'C.bbbeeb.C',
      'C.bbbbbb.C',
      'CC.bbbb.CC',
      'C......C',
      's......s',
      'ss....ss',
    ],
  },
};

interface Built {
  framesR: [THREE.Texture, THREE.Texture];
  framesL: [THREE.Texture, THREE.Texture];
  aspect: number;
  bob: Bob;
  portrait: string;
}

const built = new Map<CreatureId, Built>();

function animate(rows: string[], motion: Motion): string[] {
  let next = rows;
  if (motion.step) next = stepLegs(next);
  if (motion.flap) next = shiftLetters(next, ['W'], 0, -1);
  if (motion.bob?.length) next = shiftLetters(next, motion.bob, 0, -1);
  if (motion.flicker) next = swapChars(next, motion.flicker[0], motion.flicker[1]);
  return next;
}

function buildCreature(def: CreatureDef): { right: [HTMLCanvasElement, HTMLCanvasElement]; portrait: HTMLCanvasElement } {
  const aligned = addMargin(alignRows(def.fill, def.align), 2, 2, 2, 0);
  const posed = animate(aligned, def.motion);
  const a = outline(aligned);
  const b = outline(posed);
  const canvasA = paint(a, def.palette);
  const canvasB = paint(b, def.palette);
  return { right: [canvasA, canvasB], portrait: canvasA };
}

function getBuilt(id: CreatureId): Built {
  const hit = built.get(id);
  if (hit) return hit;
  const made = buildCreature(DEFS[id]);
  const [c0, c1] = made.right;
  const value: Built = {
    framesR: [canvasTexture(c0), canvasTexture(c1)],
    framesL: [canvasTexture(mirrorCanvas(c0)), canvasTexture(mirrorCanvas(c1))],
    aspect: c0.width / c0.height,
    bob: DEFS[id].bob,
    portrait: scaledDataURL(made.portrait, 4),
  };
  built.set(id, value);
  return value;
}

export function portraitURL(id: CreatureId): string {
  return getBuilt(id).portrait;
}

function targetLong(id: CreatureId, radius?: number): number {
  switch (id) {
    case 'fox':
      return 2.3;
    case 'turtle':
      return 2.55;
    case 'falcon':
      return 2.45;
    case 'crystal':
      return (radius ?? 0.55) * 3.35;
    case 'wolf':
      return (radius ?? 0.48) * 3.45;
    case 'beetle':
      return (radius ?? 0.7) * 3.15;
    case 'elite':
      return (radius ?? 1.1) * 3.05;
    case 'horn':
      return (radius ?? 1.85) * 2.65;
    case 'core':
      return (radius ?? 1.7) * 2.75;
    default:
      return 2;
  }
}

function creatureScale(id: CreatureId, aspect: number, radius?: number): { w: number; h: number } {
  const long = targetLong(id, radius);
  if (aspect >= 1) return { w: long, h: long / aspect };
  return { w: long * aspect, h: long };
}

export class PixelActor {
  readonly sprite: THREE.Sprite;
  readonly material: THREE.SpriteMaterial;
  width = 1;
  height = 1;
  private framesR!: [THREE.Texture, THREE.Texture];
  private framesL!: [THREE.Texture, THREE.Texture];
  private faceRight = true;
  private frame = 0;
  private bob: Bob = 'step';

  constructor(id: CreatureId, radius?: number, renderOrder = 3) {
    const vis = getBuilt(id);
    this.material = new THREE.SpriteMaterial({
      map: vis.framesR[0],
      transparent: true,
      alphaTest: 0.15,
      depthWrite: true,
      toneMapped: false,
    });
    this.sprite = new THREE.Sprite(this.material);
    this.sprite.center.set(0.5, 0);
    this.sprite.renderOrder = renderOrder;
    this.apply(id, radius);
  }

  retarget(id: CreatureId, radius?: number): void {
    this.apply(id, radius);
  }

  private apply(id: CreatureId, radius?: number): void {
    const vis = getBuilt(id);
    this.framesR = vis.framesR;
    this.framesL = vis.framesL;
    this.bob = vis.bob;
    const size = creatureScale(id, vis.aspect, radius);
    this.width = size.w;
    this.height = size.h;
    this.frame = 0;
    this.applyFrame();
    this.sprite.scale.set(this.width, this.height, 1);
  }

  setFacing(faceRight: boolean): void {
    if (this.faceRight === faceRight) return;
    this.faceRight = faceRight;
    this.applyFrame();
  }

  place(time: number, moving: boolean): void {
    const fps = moving ? 8 : 2.4;
    const next = Math.floor(time * fps) % 2;
    if (next !== this.frame) {
      this.frame = next;
      this.applyFrame();
    }
    if (this.bob === 'hover') {
      this.sprite.position.y = 0.12 + Math.sin(time * 3.1) * 0.14;
    } else {
      const amp = moving ? 0.07 : 0.028;
      this.sprite.position.y = Math.abs(Math.sin(time * (moving ? 9 : 3))) * amp;
    }
  }

  flash(strength: number): void {
    const f = 1 + Math.max(0, strength) * 2.5;
    this.material.color.setRGB(f, f, f);
  }

  setOpacity(opacity: number): void {
    this.material.opacity = opacity;
  }

  private applyFrame(): void {
    const set = this.faceRight ? this.framesR : this.framesL;
    const tex = set[this.frame];
    if (this.material.map !== tex) {
      this.material.map = tex;
      this.material.needsUpdate = true;
    }
  }

  dispose(): void {
    this.material.dispose();
  }
}

const fxCache = new Map<string, THREE.Texture | THREE.Texture[]>();

function outlined(lines: string[], palette: Record<string, string>): HTMLCanvasElement {
  const rows = addMargin(alignRows(lines, 'center'), 1, 1, 1, 1);
  return paint(outline(rows), palette);
}

function flickerPair(key: string, lines: string[], palette: Record<string, string>, a: string, b: string): [THREE.Texture, THREE.Texture] {
  const hit = fxCache.get(key);
  if (hit) return hit as [THREE.Texture, THREE.Texture];
  const base = addMargin(alignRows(lines, 'center'), 1, 1, 1, 1);
  const alt = swapChars(base, a, b);
  const pair: [THREE.Texture, THREE.Texture] = [canvasTexture(paint(outline(base), palette)), canvasTexture(paint(outline(alt), palette))];
  fxCache.set(key, pair);
  return pair;
}

const GRAY = { k: '#2a2a2a', W: '#ffffff', G: '#8d8d8d' };

export function projectileFrames(style: ShotStyle): [THREE.Texture, THREE.Texture] {
  if (style === 'shard') {
    return flickerPair('shard', ['W', 'W.W', 'WWWWW', 'W.W', 'W'], GRAY, 'W', 'G');
  }
  if (style === 'thorn') {
    return flickerPair('thorn', ['W', 'W.W', 'W...W', 'WWWWW', 'W...W', 'W.W', 'W'], GRAY, 'W', 'G');
  }
  return flickerPair('flame', ['WW', 'WWWW', 'WGGW', 'WWWW', 'W..W', 'W'], GRAY, 'W', 'G');
}

export function gemFrames(): [THREE.Texture, THREE.Texture] {
  return flickerPair(
    'gem',
    ['G', 'GGG', 'GWyWG', 'GGGGG', 'GWyWG', 'GGG', 'G'],
    { k: '#08332e', G: '#5dffe0', W: '#fff6c4', y: '#fff6c4' },
    'W',
    'G',
  );
}

const SPARKS = [
  ['W', 'W', 'WWW', 'W', 'W'],
  ['WWW', 'WGW', 'WWW'],
  ['W', 'W.W', 'W'],
];

export function sparkTexture(index: number): THREE.Texture {
  const key = `spark${index}`;
  const hit = fxCache.get(key);
  if (hit && !Array.isArray(hit)) return hit;
  const tex = canvasTexture(outlined(SPARKS[index] ?? SPARKS[0], GRAY));
  fxCache.set(key, tex);
  return tex;
}

export function badgeTexture(): THREE.Texture {
  const hit = fxCache.get('badge');
  if (hit && !Array.isArray(hit)) return hit;
  const tex = canvasTexture(outlined(['W', 'WWW', 'WWWWW', 'WWW', 'W'], { k: '#1a1208', W: '#ffffff' }));
  fxCache.set('badge', tex);
  return tex;
}

export function warmupSprites(): void {
  (Object.keys(DEFS) as CreatureId[]).forEach((id) => {
    getBuilt(id);
  });
  projectileFrames('flame');
  projectileFrames('shard');
  projectileFrames('thorn');
  gemFrames();
  sparkTexture(0);
  sparkTexture(1);
  sparkTexture(2);
  badgeTexture();
}
