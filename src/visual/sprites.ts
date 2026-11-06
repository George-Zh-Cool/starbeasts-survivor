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
  | 'core'
  | 'moth'
  | 'crab';

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
  /** 站立帧。空点用 `.`，行可以长短不一。 */
  fill: string[];
  /** 迈步 / 振翅帧。有它时站立只播 fill，移动才切到这一帧。 */
  walk?: string[];
}

const DEFS: Record<CreatureId, CreatureDef> = {
  fox: {
    align: 'left',
    bob: 'step',
    motion: { step: true },
    palette: {
      k: '#2a120c',
      i: '#ffc2a4',
      o: '#ff5a36',
      d: '#b33018',
      e: '#1a0c08',
      w: '#fff8f2',
      m: '#ffe0b8',
      F: '#fff6c2',
      f: '#ffb703',
      L: '#e24b2a',
    },
    fill: [
      '..........ii..ii',
      '.........iooiiooi',
      '..........oooooo',
      '.....FFFF.odddoo',
      '....FfffF.oowweem',
      '....Fff...oowwwmm',
      '.....FF...oooooooo',
      '..........ooddoooo',
      '..........oooooooo',
      '...........ooooooo',
      '............oo..oo',
      '............LL..LL',
      '............LL..LL',
    ],
    walk: [
      '.....FFFF..ii..ii',
      '....FfffF.iooiiooi',
      '....Fff....oooooo',
      '.....FF....odddoo',
      '...........oowweem',
      '...........oowwwmm',
      '...........oooooooo',
      '...........ooddoooo',
      '............ooooooo',
      '.............oo..oo',
      '............LL....LL',
      '............LL....LL',
      '................',
    ],
  },
  turtle: {
    align: 'left',
    bob: 'step',
    motion: { step: true },
    palette: {
      k: '#04221e',
      S: '#1aa396',
      p: '#e9fffb',
      h: '#7ee0d0',
      m: '#f4fffc',
      e: '#062420',
      w: '#ffffff',
      b: '#0c3f3a',
      L: '#14685e',
    },
    fill: [
      '...............mmm',
      '..........SSSSbmmee',
      '.SSSSSSSSSSSSSSmmmm',
      'SSppSSppSSppSSSSSb',
      'SSSSSSShSSShSSSSS',
      'SSSSSSSSSSSSSSSS',
      '.SSSSSSSSSSSSSS',
      '..LL..SSSSSS..LL',
      '..LL...SSSS...LL',
    ],
    walk: [
      '...............mmm',
      '..........SSSSbmmee',
      '.SSSSSSSSSSSSSSmmmm',
      'SSppSSppSSppSSSSSb',
      'SSSSSSShSSShSSSSS',
      'SSSSSSSSSSSSSSSS',
      '.SSSSSSSSSSSSSS',
      '.LL....SSSS....LL',
      '..........SS',
    ],
  },
  falcon: {
    align: 'left',
    bob: 'step',
    motion: { step: true },
    palette: {
      k: '#1a0a28',
      c: '#f3e4ff',
      W: '#c77dff',
      b: '#6d28b8',
      d: '#431270',
      e: '#140818',
      y: '#ffd166',
      w: '#fff6ee',
      L: '#3a1060',
    },
    fill: [
      '..........cccc',
      '.........ccccccc',
      '....WWWWWWcWWWWWWW',
      '...WWWbbbbbbbbbbWW',
      '..WWbbbbbeeeeyyybb',
      '..WWbbbbwwwwbbbbbb',
      '...WWbbbbbbbbbbbb',
      '......bbbbbbbbbb',
      '.......dd....dd',
      '.......LL....LL',
      '.......LL....LL',
    ],
    walk: [
      '..WW............WW',
      '...WW...cccc...WW',
      '....WWcccccccWW',
      '.....WbbbbbbbbW',
      '..WWbbbeeeeyybbWW',
      '...WbbbwwwwbbbW',
      '.....bbbbbbbb',
      '......dd..dd',
      '......LL..LL',
      '..............',
    ],
  },
  wolf: {
    align: 'left',
    bob: 'step',
    motion: { step: true },
    palette: {
      k: '#1a0612',
      b: '#e231a4',
      d: '#7a1058',
      c: '#ffd0ea',
      e: '#1a060c',
      w: '#fff6c4',
      m: '#2a0816',
      L: '#9a1468',
    },
    fill: [
      '.................bb',
      '................beeb',
      '..........bbbbbbbbbbbb',
      '.......bbbbbbcccccbbbb',
      '....bbbbbbbbbbbbbbmmmm',
      '...bbbbbweeebbbbbmmmm',
      '....bbbb..bbb..bbbb',
      '....LL......LL..LL',
      '....LL......LL..LL',
    ],
    walk: [
      '.................bb',
      '................beeb',
      '..........bbbbbbbbbbbb',
      '.......bbbbbbcccccbbbb',
      '....bbbbbbbbbbbbbbmmmm',
      '...bbbbbweeebbbbbmmmm',
      '....bbbb..bbb..bbbb',
      '...LL........LL...L',
      '................LL',
    ],
  },
  beetle: {
    align: 'center',
    bob: 'step',
    motion: { step: true },
    palette: {
      k: '#d8fbff',
      c: '#f4feff',
      b: '#2a558c',
      h: '#8ef6ff',
      e: '#1a2438',
      w: '#ffe56a',
      L: '#10243c',
    },
    fill: [
      '.....c....c',
      '....cc....cc',
      '...bbbbbbbb',
      '..bbhhhhhhbb',
      '.bbbweebweebbb',
      '..bbbbbbbbbb',
      '.bbhhhhhhhhbb',
      'LL..LL....LL..LL',
      'L....L......L...L',
    ],
    walk: [
      '.....c....c',
      '....cc....cc',
      '...bbbbbbbb',
      '..bbhhhhhhbb',
      '.bbbweebweebbb',
      '..bbbbbbbbbb',
      '.bbhhhhhhhhbb',
      'L...LL..LL...L',
      '.L...L....L...L',
    ],
  },
  crystal: {
    align: 'center',
    bob: 'hover',
    motion: { flicker: ['G', 'C'] },
    palette: {
      k: '#16101f',
      G: '#f7f4ff',
      C: '#c4b6ee',
      c: '#6d5e96',
      e: '#1a1428',
      W: '#7cf6ff',
    },
    fill: [
      '....GG',
      '...GWWG',
      '..GWcCWG',
      '.GWceecWG',
      'GWccccccWG',
      '.CccccccC',
      '..CccccC',
      '...CCCC',
      '...c..c',
      '...c..c',
    ],
  },
  elite: {
    align: 'center',
    bob: 'step',
    motion: { step: true },
    palette: {
      k: '#1a0610',
      g: '#ffd166',
      G: '#fff6c8',
      b: '#e1066a',
      d: '#8a0040',
      e: '#1a060c',
      w: '#fff3bf',
      L: '#c41258',
    },
    fill: [
      '...gGGGGg',
      '....gGGg',
      '...bbbbbb',
      '..bbwweewwbb',
      '..bbbbbbbbbb',
      'bbbbbbbbbbbbbb',
      'bbbddddddddbbb',
      '.bbb......bbb',
      '.LLL......LLL',
      '.LL........LL',
      '.LL........LL',
    ],
    walk: [
      '...gGGGGg',
      '....gGGg',
      '...bbbbbb',
      '..bbwweewwbb',
      '..bbbbbbbbbb',
      'bbbbbbbbbbbbbb',
      'bbbddddddddbbb',
      '.bbb......bbb',
      'LL..........LL',
      '.LL........LL',
      '..............',
    ],
  },
  horn: {
    align: 'center',
    bob: 'step',
    motion: { step: true },
    palette: {
      k: '#2a0a10',
      g: '#ffd166',
      G: '#fff6c8',
      b: '#ff4d6d',
      d: '#9a1834',
      e: '#1a0608',
      w: '#fff1f4',
      m: '#ffd0d8',
      L: '#d43458',
    },
    fill: [
      'gG........gG........gG',
      'gg........gg........gg',
      '.g........gG........g',
      '........bbbbbbbb',
      '......bbbbbbbbbbbb',
      '....bbwwwbbbbbwwwbb',
      '...bbbbbeeeeebbbbbb',
      '..bbbbmmmmmmmmbbbbb',
      '...bbbbbddddbbbbbb',
      '....bbbb....bbbb',
      '....LLL......LLL',
      '....LL........LL',
      '....LL........LL',
    ],
    walk: [
      'gG........gG........gG',
      'gg........gg........gg',
      '.g........gG........g',
      '........bbbbbbbb',
      '......bbbbbbbbbbbb',
      '....bbwwwbbbbbwwwbb',
      '...bbbbbeeeeebbbbbb',
      '..bbbbmmmmmmmmbbbbb',
      '...bbbbbddddbbbbbb',
      '....bbbb....bbbb',
      '...LL..........LL',
      '....LL........LL',
      '....................',
    ],
  },
  core: {
    align: 'center',
    bob: 'hover',
    motion: { flicker: ['G', 'C'] },
    palette: {
      k: '#140820',
      G: '#f4fbff',
      C: '#4cc9f0',
      b: '#7a2ec4',
      d: '#4a148c',
      e: '#1a0a28',
      w: '#ffffff',
      s: '#e7c6ff',
    },
    fill: [
      '...GGCCCCGG',
      '..GCCCCCCCCG',
      '.CCbbbbbbbbCC',
      '.CbwwbeebwwbC',
      '.CCbbbbbbbbCC',
      '..CCbbbbbbCC',
      '...CC....CC',
      '...s......s',
      '....ss..ss',
    ],
  },
  moth: {
    align: 'center',
    bob: 'hover',
    motion: { flap: true, flicker: ['y', 'Y'] },
    palette: {
      k: '#3a2208',
      W: '#ffe08a',
      y: '#ffb703',
      Y: '#fff3c4',
      b: '#5c3d16',
      e: '#1a0c04',
      m: '#fff6d8',
    },
    fill: [
      '..WW......WW..',
      '.WyyWW..WWyyW.',
      'WyyyYYyyYYyyyW',
      '.WyyWWbbWWyyW.',
      '..WWWbbbbWWW..',
      '....bbeeebb...',
      '.....bmmmb....',
      '......bbbb....',
    ],
  },
  crab: {
    align: 'center',
    bob: 'step',
    motion: { step: true },
    palette: {
      k: '#2a1408',
      c: '#e7a15a',
      C: '#fff0d2',
      b: '#a85a28',
      d: '#6a3014',
      e: '#1a0c06',
      L: '#c46a32',
    },
    fill: [
      '..cc........cc..',
      '.cCcc......ccCc.',
      'ccCCcc....ccCCcc',
      '.cccccccccccccc.',
      '.ccceee..eeeccc.',
      '..ccbbbbbbbbcc..',
      '...ccddddddcc...',
      '...LL..LL..LL...',
      '...LL..LL..LL...',
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

/** 两帧对齐到同一包围盒，脚底对齐，避免迈步时精灵跳高或变宽。 */
function normalizePair(idleSrc: string[], walkSrc: string[] | undefined, align: Align): [string[], string[]] {
  const idle = alignRows(idleSrc, align);
  const walk = alignRows(walkSrc ?? idleSrc, align);
  const width = Math.max(idle[0].length, walk[0].length);
  const height = Math.max(idle.length, walk.length);
  const fit = (rows: string[]): string[] => {
    const wide = rows.map((row) => {
      const pad = width - row.length;
      if (pad < 0) throw new Error('像素行比包围盒宽');
      if (align === 'center') {
        const left = Math.floor(pad / 2);
        return `${'.'.repeat(left)}${row}${'.'.repeat(pad - left)}`;
      }
      return row.padEnd(width, '.');
    });
    while (wide.length < height) wide.unshift('.'.repeat(width));
    return wide;
  };
  return [fit(idle), fit(walk)];
}

function buildCreature(def: CreatureDef): { right: [HTMLCanvasElement, HTMLCanvasElement]; portrait: HTMLCanvasElement } {
  const [idle, walk] = normalizePair(def.fill, def.walk, def.align);
  const posed = def.walk ? walk : animate(idle, def.motion);
  const canvasA = paint(outline(idle), def.palette);
  const canvasB = paint(outline(posed), def.palette);
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

/** 世界高度。侧视角色按高度定尺寸，避免宽画布把身体压成一条。 */
function targetHeight(id: CreatureId, radius?: number): number {
  switch (id) {
    case 'fox':
      return 2.35;
    case 'turtle':
      return 2.2;
    case 'falcon':
      return 2.38;
    case 'crystal':
      return (radius ?? 0.55) * 3.55;
    case 'wolf':
      return (radius ?? 0.48) * 3.7;
    case 'beetle':
      return (radius ?? 0.7) * 2.65;
    case 'elite':
      return (radius ?? 1.1) * 2.45;
    case 'horn':
      return (radius ?? 1.85) * 2.02;
    case 'core':
      return (radius ?? 1.7) * 2.15;
    case 'moth':
      return (radius ?? 0.4) * 3.6;
    case 'crab':
      return (radius ?? 0.78) * 2.55;
    default:
      return 2;
  }
}

function creatureScale(id: CreatureId, aspect: number, radius?: number): { w: number; h: number } {
  const h = targetHeight(id, radius);
  return { w: h * aspect, h };
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
    let next = 0;
    if (this.bob === 'hover') {
      next = Math.floor(time * (moving ? 7 : 2.1)) % 2;
      this.sprite.position.y = 0.16 + Math.sin(time * (moving ? 4.4 : 2.3)) * (moving ? 0.16 : 0.07);
    } else if (moving) {
      next = Math.floor(time * 10) % 2;
      this.sprite.position.y = Math.abs(Math.sin(time * 10)) * 0.1;
    } else {
      next = 0;
      this.sprite.position.y = (Math.sin(time * 2.1) * 0.5 + 0.5) * 0.035;
    }
    if (next !== this.frame) {
      this.frame = next;
      this.applyFrame();
    }
  }

  flash(strength: number): void {
    const f = 1 + Math.max(0, strength) * 3.6;
    const c = Math.min(3.4, f);
    this.material.color.setRGB(c, c, c);
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
    return flickerPair(
      'shard',
      ['....W', '...WWW', '..WWGWW', '.WWWWWWW', '..WWGWW', '...WWW', '....W'],
      GRAY,
      'W',
      'G',
    );
  }
  if (style === 'thorn') {
    return flickerPair(
      'thorn',
      ['....W', '...W.W', '..W.G.W', '.WWWWWWW', '..W.G.W', '...W.W', '....W'],
      GRAY,
      'W',
      'G',
    );
  }
  return flickerPair(
    'flame',
    ['...WW', '..WWWW', '.WWGGWW', 'WWGGGGWW', '.WWGGWW', '..WGGW', '...WW'],
    GRAY,
    'W',
    'G',
  );
}

export function gemFrames(): [THREE.Texture, THREE.Texture] {
  return flickerPair(
    'gem',
    ['....G', '...GGG', '..GWWWG', '.GWyyWG', 'GGWyyWGG', '.GWyyWG', '..GWWWG', '...GGG', '....G'],
    { k: '#08332e', G: '#5dffe0', W: '#ffffff', y: '#fff6c4' },
    'W',
    'y',
  );
}

const SPARKS = [
  ['..W', '.W.W', 'WWWWW', '.W.W', '..W'],
  ['.WWW', 'WWGWW', 'WGGGW', 'WWGWW', '.WWW'],
  ['W', 'W.W', 'W...W', 'W.W', 'W'],
];

export function sparkTexture(index: number): THREE.Texture {
  const key = `spark${index}`;
  const hit = fxCache.get(key);
  if (hit && !Array.isArray(hit)) return hit;
  const tex = canvasTexture(outlined(SPARKS[index] ?? SPARKS[0], GRAY));
  fxCache.set(key, tex);
  return tex;
}

const PROP_ART: Record<'rock' | 'crystal', { lines: string[]; palette: Record<string, string> }> = {
  rock: {
    palette: { k: '#1a1e28', D: '#3a4156', G: '#8b93a8', W: '#d5dbea' },
    lines: ['....WW', '..GGWWGG', '.GGGGGGGG', 'GGDDGGDDGG', 'DDDDDDDDDD', '.DDDDDDDD'],
  },
  crystal: {
    palette: { k: '#083038', C: '#7ee7f2', W: '#f4fdff', c: '#1a6a78' },
    lines: ['...CC', '..CWWC', '.CCCCCC', 'C.cc.cc.C', '.C.CWWC.C', '..CCCC', '...c..c'],
  },
};

export function propVisual(kind: 'rock' | 'crystal'): { texture: THREE.Texture; aspect: number } {
  const key = `prop-${kind}`;
  const hit = fxCache.get(key);
  if (hit && !Array.isArray(hit)) {
    const img = hit.image as HTMLCanvasElement;
    return { texture: hit, aspect: img.width / img.height };
  }
  const art = PROP_ART[kind];
  const canvas = outlined(art.lines, art.palette);
  const tex = canvasTexture(canvas);
  fxCache.set(key, tex);
  return { texture: tex, aspect: canvas.width / canvas.height };
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
  propVisual('rock');
  propVisual('crystal');
}
