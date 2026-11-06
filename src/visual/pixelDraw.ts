/** 程序绘制像素画布。不加载外部贴图。 */
import * as THREE from 'three';

export function alignRows(lines: string[], mode: 'left' | 'center'): string[] {
  const cleaned = lines.map((line) => line.replace(/\s+$/g, ''));
  for (const line of cleaned) {
    if (line.includes(' ')) throw new Error(`像素行含空格: ${line}`);
  }
  const width = Math.max(...cleaned.map((line) => line.length));
  return cleaned.map((line) => {
    if (mode === 'left') return line.padEnd(width, '.');
    const pad = width - line.length;
    const left = Math.floor(pad / 2);
    return `${'.'.repeat(left)}${line}${'.'.repeat(pad - left)}`;
  });
}

export function addMargin(rows: string[], left: number, right: number, top: number, bottom: number): string[] {
  const width = rows[0].length + left + right;
  const blank = '.'.repeat(width);
  const mid = rows.map((row) => `${'.'.repeat(left)}${row}${'.'.repeat(right)}`);
  return [...Array(top).fill(blank), ...mid, ...Array(bottom).fill(blank)];
}

/** 空像素若挨着实心像素，涂成描边。网格四边各扩 1 像素。 */
export function outline(rows: string[], key = 'k'): string[] {
  const height = rows.length;
  const width = rows[0].length;
  const src = rows.map((row) => row.split(''));
  const H = height + 2;
  const W = width + 2;
  const grid: string[][] = Array.from({ length: H }, () => Array(W).fill('.'));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) grid[y + 1][x + 1] = src[y][x];
  }
  const out = grid.map((row) => row.slice());
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (grid[y][x] !== '.') continue;
      let touch = false;
      for (let dy = -1; dy <= 1 && !touch; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const ny = y + dy;
          const nx = x + dx;
          if (ny < 0 || nx < 0 || ny >= H || nx >= W) continue;
          if (grid[ny][nx] !== '.') touch = true;
        }
      }
      if (touch) out[y][x] = key;
    }
  }
  return out.map((row) => row.join(''));
}

/** 每格画成 scale×scale，最近邻采样时轮廓更稳。 */
export function paint(rows: string[], palette: Record<string, string>, scale = 2): HTMLCanvasElement {
  const height = rows.length;
  const width = rows[0].length;
  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建画布');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < height; y++) {
    const row = rows[y];
    if (row.length !== width) throw new Error('像素行宽度不一致');
    for (let x = 0; x < width; x++) {
      const ch = row[x];
      if (ch === '.') continue;
      const color = palette[ch];
      if (!color) throw new Error(`像素调色板缺少 "${ch}"`);
      ctx.fillStyle = color;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }
  return canvas;
}

function swapChar(text: string, a: string, b: string): string {
  let out = '';
  for (const ch of text) {
    if (ch === a) out += b;
    else if (ch === b) out += a;
    else out += ch;
  }
  return out;
}

export function swapChars(rows: string[], a: string, b: string): string[] {
  return rows.map((row) => swapChar(row, a, b));
}

export function shiftLetters(rows: string[], letters: string[], dx: number, dy: number): string[] {
  const set = new Set(letters);
  const height = rows.length;
  const width = rows[0].length;
  const grid = rows.map((row) => row.split(''));
  const cells: { x: number; y: number; ch: string }[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const ch = grid[y][x];
      if (set.has(ch)) cells.push({ x, y, ch });
    }
  }
  for (const cell of cells) grid[cell.y][cell.x] = '.';
  for (const cell of cells) {
    const nx = cell.x + dx;
    const ny = cell.y + dy;
    if (nx >= 0 && ny >= 0 && nx < width && ny < height && grid[ny][nx] === '.') grid[ny][nx] = cell.ch;
    else if (grid[cell.y][cell.x] === '.') grid[cell.y][cell.x] = cell.ch;
  }
  return grid.map((row) => row.join(''));
}

/** 底排像素按左右分组各挪 1 格，做成两帧迈步。 */
export function stepLegs(rows: string[]): string[] {
  const height = rows.length;
  const width = rows[0].length;
  const grid = rows.map((row) => row.split(''));
  const cells: { x: number; y: number }[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (grid[y][x] === 'L') cells.push({ x, y });
    }
  }
  if (!cells.length) return rows;
  const xs = cells.map((cell) => cell.x).sort((a, b) => a - b);
  const mid = xs[Math.floor((xs.length - 1) / 2)];
  for (const cell of cells) grid[cell.y][cell.x] = '.';
  for (const cell of cells) {
    const dir = cell.x <= mid ? -1 : 1;
    const nx = cell.x + dir;
    const ny = cell.y;
    if (nx >= 0 && ny >= 0 && nx < width && ny < height && grid[ny][nx] === '.') grid[ny][nx] = 'L';
    else if (grid[cell.y][cell.x] === '.') grid[cell.y][cell.x] = 'L';
  }
  return grid.map((row) => row.join(''));
}

export function canvasTexture(source: HTMLCanvasElement, repeat = false): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(source);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  const wrap = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.wrapS = wrap;
  tex.wrapT = wrap;
  tex.needsUpdate = true;
  return tex;
}

export function mirrorCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建画布');
  ctx.imageSmoothingEnabled = false;
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(source, 0, 0);
  return canvas;
}

export function scaledDataURL(source: HTMLCanvasElement, factor: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = source.width * factor;
  canvas.height = source.height * factor;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建画布');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
}

const GLYPHS: Record<string, string[]> = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01111', '10000', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '10101', '01010'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
};

const wordCache = new Map<string, string>();

/** 5×7 点阵英文，只覆盖拉丁标题，不下载字体文件。 */
export function wordmarkURL(text: string, color = '#f2c14e'): string {
  const key = `${text}|${color}`;
  const hit = wordCache.get(key);
  if (hit) return hit;
  const scale = 4;
  const gap = scale;
  const glyphW = 5 * scale;
  const width = Math.max(1, text.length * (glyphW + gap) - gap);
  const height = 7 * scale;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建画布');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = color;
  let pen = 0;
  for (const ch of text.toUpperCase()) {
    const glyph = GLYPHS[ch] ?? GLYPHS[' '];
    for (let y = 0; y < glyph.length; y++) {
      for (let x = 0; x < glyph[y].length; x++) {
        if (glyph[y][x] === '1') ctx.fillRect(pen + x * scale, y * scale, scale, scale);
      }
    }
    pen += glyphW + gap;
  }
  const url = canvas.toDataURL('image/png');
  wordCache.set(key, url);
  return url;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 夜色石砖。两档冷色区分砖面，砖缝压暗。
 * 杂点很少，避免远看糊成噪声。
 */
export function paintGround(size = 256): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建画布');
  const rand = mulberry32(0x51a7e3);
  const tile = 16;
  const tiles = size / tile;
  for (let ty = 0; ty < tiles; ty++) {
    for (let tx = 0; tx < tiles; tx++) {
      const roll = rand();
      const checker = ((tx + ty) & 1) === 0;
      let rgb: [number, number, number] = checker ? [16, 24, 46] : [34, 48, 82];
      if (roll < 0.04) rgb = checker ? [20, 36, 58] : [28, 52, 78];
      ctx.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
      ctx.fillRect(tx * tile, ty * tile, tile, tile);
      ctx.fillStyle = '#060814';
      ctx.fillRect(tx * tile, ty * tile, tile, 1);
      ctx.fillRect(tx * tile, ty * tile, 1, tile);
      if (roll < 0.18) {
        const sx = tx * tile + 3 + Math.floor(rand() * (tile - 6));
        const sy = ty * tile + 3 + Math.floor(rand() * (tile - 6));
        ctx.fillStyle = rand() > 0.45 ? 'rgba(186,206,255,0.22)' : 'rgba(0,0,0,0.28)';
        ctx.fillRect(sx, sy, 1, 1);
      }
      if (roll > 0.992) {
        ctx.fillStyle = '#9aeff8';
        ctx.fillRect(tx * tile + 7, ty * tile + 7, 2, 2);
        ctx.fillStyle = '#f4fdff';
        ctx.fillRect(tx * tile + 7, ty * tile + 7, 1, 1);
      }
    }
  }
  return canvas;
}

export function paintSky(size = 128): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建画布');
  const bands = ['#070814', '#0b1024', '#12183a', '#1a2450', '#24325e', '#2a3058', '#241e40', '#16182e'];
  const bandH = size / bands.length;
  bands.forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, Math.floor(i * bandH), size, Math.ceil(bandH));
  });
  const rand = mulberry32(0xc0ffee);
  for (let i = 0; i < 90; i++) {
    const x = Math.floor(rand() * size);
    const y = Math.floor(rand() * size * 0.72);
    const gold = rand() > 0.86;
    ctx.fillStyle = gold ? '#ffd98a' : '#e7eeff';
    const s = gold && rand() > 0.5 ? 2 : 1;
    ctx.fillRect(x, y, s, s);
  }
  return canvas;
}

/** 地面上的虚线环，给战场一个尺度，不是光滑矢量线圈。 */
export function paintMarks(size = 256): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建画布');
  const img = ctx.createImageData(size, size);
  const cx = (size - 1) / 2;
  const cy = (size - 1) / 2;
  const rings = [
    { r: 46, rgb: [90, 120, 180] },
    { r: 92, rgb: [210, 170, 90] },
    { r: 132, rgb: [70, 96, 150] },
  ];
  for (const ring of rings) {
    const steps = Math.floor(ring.r * 3.2);
    for (let i = 0; i < steps; i++) {
      if (Math.floor(i / 2) % 2 === 0) continue;
      const a = (i / steps) * Math.PI * 2;
      const x = Math.round(cx + Math.cos(a) * ring.r);
      const y = Math.round(cy + Math.sin(a) * ring.r);
      for (let oy = 0; oy < 2; oy++) {
        for (let ox = 0; ox < 2; ox++) {
          const px = x + ox;
          const py = y + oy;
          if (px < 0 || py < 0 || px >= size || py >= size) continue;
          const idx = (py * size + px) * 4;
          img.data[idx] = ring.rgb[0];
          img.data[idx + 1] = ring.rgb[1];
          img.data[idx + 2] = ring.rgb[2];
          img.data[idx + 3] = 170;
        }
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

export function paintRing(size = 64): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建画布');
  const img = ctx.createImageData(size, size);
  const c = (size - 1) / 2;
  const outer = size * 0.47;
  const inner = size * 0.36;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - c, y - c);
      if (d > outer || d < inner) continue;
      const idx = (y * size + x) * 4;
      img.data[idx] = 255;
      img.data[idx + 1] = 255;
      img.data[idx + 2] = 255;
      img.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

export function paintShadow(): HTMLCanvasElement {
  const w = 32;
  const h = 16;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建画布');
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px = Math.floor(x / 2) * 2 + 0.5;
      const py = Math.floor(y / 2) * 2 + 0.5;
      const nx = (px - 15.5) / 13;
      const ny = (py - 7.5) / 5.2;
      const d = nx * nx + ny * ny;
      if (d > 1) continue;
      const idx = (y * w + x) * 4;
      img.data[idx + 3] = d < 0.4 ? 160 : 100;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}
